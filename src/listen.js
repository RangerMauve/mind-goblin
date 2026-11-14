import fs from "node:fs";
import path from "node:path";
import { execa } from "execa";
import cpal from "node-cpal";
import sherpa from "sherpa-onnx-node";

import { Goblin, USER } from "./index.js";
import { Sessions } from "./sessions.js";
import { dataDir, sessionFolder } from "./utils.js";
import speakTool from "./tools/speak.js";
import { Logger } from "./logger.js";
import { makeProgressLogging } from "./progress-logging.js";

/** @import {Message} from "./index.js" */
/** @import {Config} from "./utils.js" */
/** @typedef {import("sherpa-onnx-node").Vad} VadType */
/** @typedef {import("sherpa-onnx-node").OfflineRecognizer} RecognizerType */
/** @typedef {import("sherpa-onnx-node").LinearResampler} ResamplerType */

/**
 * @typedef {Config & {
 *   config: Config,
 *   debug?: boolean,
 *   showThinking?: boolean,
 *   session?: string,
 *   clear?: boolean,
 *   speak?: boolean,
 *   trigger?: string,
 * }} ListenOptions
 */

const TARGET_SAMPLE_RATE = 16000;
const VAD_WINDOW_SIZE = 512; // 32ms at 16kHz

export const MODELS_BASE =
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models";
export const VAD_MODEL_URL = `${MODELS_BASE}/silero_vad.onnx`;
export const ASR_MODEL_URL = `${MODELS_BASE}/sherpa-onnx-moonshine-tiny-en-int8.tar.bz2`;

/**
/**
 * @param {ListenOptions} options
 */
export async function listen(options) {
  const {
    session,
    clear,
    speak: doSpeak = true,
    showThinking,
    config,
    ...goblinOpts
  } = options;

  const logger = new Logger();

  // 1. Ensure models exist + build VAD + recognizer
  const { vad, recognizer } = await initModels(logger);

  // 2. Setup goblin session
  const goblin = await Goblin.fromOptions({ ...goblinOpts, config });
  const sessions = new Sessions(sessionFolder);
  const session_ = sessions.make(session);
  /** @type {Message[]} */
  let messages = [];
  if (session && !clear) {
    messages = await session_.load();
  }

  // 3. Open mic as async generator
  const device = cpal.getDefaultInputDevice();
  if (!device) throw new Error("No input device found");
  const inputConfig = cpal.getDefaultInputConfig(device.deviceId);
  const nativeRate = inputConfig.sampleRate;
  /** @type {ResamplerType | null} */
  const resampler =
    nativeRate !== TARGET_SAMPLE_RATE
      ? new sherpa.LinearResampler(nativeRate, TARGET_SAMPLE_RATE)
      : null;

  const controller = new AbortController();

  const speakLogger = new Logger({
    log: (msg) => {
      logger.quiet(msg);
      if (doSpeak) speakTool({ message: msg }, goblin, controller.signal);
    },
  });

  logger.info("Listening... (Ctrl+C to stop)");

  // 7. Graceful shutdown
  process.on("SIGINT", () => controller.abort());
  // Stream: audio → transcribed lines → goblin
  const audio = openMic(resampler, controller.signal);
  const lines = processAudio(audio, vad, recognizer, controller.signal);

  let abortLast = new AbortController();

  const { onprogress, onbeforetool, onthinking } = makeProgressLogging({
    showThinking,
    logger: speakLogger,
  });

  /** @param {AbortSignal} signal */
  async function crank(signal) {
    try {
      const response = await goblin.crank(messages, {
        signal,
        onprogress,
        onbeforetool,
        onthinking,
      });
      if (signal.aborted) return;

      speakLogger.assistant(response.content);

      if (doSpeak) {
        await speakTool(
          { message: response.content.trim().replaceAll("\n", " ") },
          goblin,
          signal,
        );
      }
    } catch (e) {
      logger.warn(`Goblin error: ${/** @type {Error} */ (e).message}`);
    }
    if (signal.aborted) return;

    await session_.save(messages);
  }

  // Buffer transcribed lines until the user says the trigger phrase, then
  // flush them into a single turn. Ctrl+C (abort) drops any unflushed buffer.
  const trigger = (options.trigger ?? options.listenTrigger ?? "execute")
    .trim()
    .toLowerCase();
  /** @type {string[]} */
  const buffer = [];

  function flush() {
    if (!buffer.length) return;
    const joined = buffer.join("\n");
    buffer.length = 0;
    mergeUserMessages(messages, joined);
    logger.info("Thinking...");
    // interrupt whatever it was doing to focus on the new message
    abortLast.abort();
    abortLast = new AbortController();
    const signal = AbortSignal.any([abortLast.signal, controller.signal]);
    crank(signal);
  }

  for await (const text of lines) {
    const rest = stripTrigger(text, trigger);
    if (rest === null) {
      buffer.push(text);
      logger.user(text);
    } else {
      // trigger detected: keep the line (unless it's a bare trigger), then flush
      if (rest) {
        buffer.push(rest);
        logger.user(rest);
      }
      flush();
    }
  }

  session_.save(messages);
  console.log("\nDone.");
}

/**
 * Open the default input device and yield resampled audio chunks.
 * @param {ResamplerType | null} resampler
 * @param {AbortSignal} [signal]
 * @returns {AsyncGenerator<Float32Array>}
 */
export async function* openMic(
  resampler,
  signal = new AbortController().signal,
) {
  const device = cpal.getDefaultInputDevice();
  if (!device) throw new Error("No input device found");
  const inputConfig = cpal.getDefaultInputConfig(device.deviceId);

  /** @type {Float32Array[]} */
  const queue = [];
  /** @type {((value?: unknown) => void) | null} */
  let resolveNext = null;

  /** @type {import("node-cpal").StreamHandle} */
  const stream = cpal.createStream(
    device.deviceId,
    true,
    {
      sampleRate: inputConfig.sampleRate,
      channels: 1,
      format: "f32",
    },
    (data) => {
      queue.push(data);
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r();
      }
    },
  );

  const onAbort = () => {
    cpal.closeStream(stream);
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  };
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    while (!signal.aborted) {
      if (queue.length === 0) {
        await new Promise((r) => (resolveNext = r));
        continue;
      }
      const data = queue.shift();
      if (!data) break;
      yield resampler ? resampler.resample(data) : data;
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
    cpal.closeStream(stream);
  }
}

/**
 * Feed audio chunks through VAD + ASR, yielding transcribed text.
 * @param {AsyncGenerator<Float32Array>} audio
 * @param {VadType} vad
 * @param {RecognizerType} recognizer
 * @param {AbortSignal} [signal]
 * @returns {AsyncGenerator<string>}
 */
export async function* processAudio(
  audio,
  vad,
  recognizer,
  signal = new AbortController().signal,
) {
  const buffer = new sherpa.CircularBuffer(30 * TARGET_SAMPLE_RATE);

  for await (const data of audio) {
    if (signal.aborted) break;

    buffer.push(data);
    while (buffer.size() >= VAD_WINDOW_SIZE) {
      const chunk = buffer.get(buffer.head(), VAD_WINDOW_SIZE);
      buffer.pop(VAD_WINDOW_SIZE);
      vad.acceptWaveform(chunk);
    }

    while (!vad.isEmpty()) {
      const segment = vad.front();
      vad.pop();
      const text = transcribe(segment.samples, recognizer);
      if (text.trim()) yield text;
    }
  }
}

/**
 * Merge flushed speech into the message history. If the most recent message is
 * a USER message with string content, the text is appended to it (coalescing
 * consecutive utterances into one message); otherwise a new USER message is
 * pushed.
 * @param {Message[]} messages The conversation history
 * @param {string} text The flushed speech to merge in
 */
export function mergeUserMessages(messages, text) {
  const last = messages.at(-1);
  if (last?.role === USER && typeof last.content === "string") {
    last.content += "\n" + text;
  } else {
    messages.push({ role: USER, content: text });
  }
}

/**
 * Detect the trigger phrase in a line. When the trigger is the only word on
 * the line (ignoring punctuation/case) the whole line is dropped (returns
 * `""`). When the trigger appears alongside other words, the full line is
 * returned unchanged so the agent still sees the trigger in context. Returns
 * `null` when the trigger is not present.
 * @param {string} line A transcribed line
 * @param {string} trigger The (lowercased) trigger phrase to match
 * @returns {string | null} `""` for a bare trigger, the full line otherwise, or null if absent
 */
export function stripTrigger(line, trigger) {
  const re = new RegExp(`\\b${escapeRegExp(trigger)}\\b`, "i");
  if (!re.test(line)) return null;
  /**
   * Strip all non-word chars so "Execute!" and "execute" compare equal.
   * @param {string} s
   */
  const wordsOnly = (s) => s.replace(/[^0-9a-zA-Z_]/g, "").toLowerCase();
  return wordsOnly(line) === wordsOnly(trigger) ? "" : line;
}

/** @param {string} s */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, (c) => "\\" + c);
}

/**
 * @param {Float32Array} samples
 * @param {RecognizerType} recognizer
 * @returns {string}
 */
function transcribe(samples, recognizer) {
  const stream = recognizer.createStream();
  stream.acceptWaveform({ samples, sampleRate: TARGET_SAMPLE_RATE });
  recognizer.decode(stream);
  const result = recognizer.getResult(stream);
  return result.text;
}

/**
 * Download (if needed) and initialize VAD + ASR models.
 * @param {Logger} [logger]
 * @param {string} [storageDir] Directory to store models. Defaults to dataDir/models.
 * @returns {Promise<{vadPath: string, asrDir: string, vad: VadType, recognizer: RecognizerType}>}
 */
export async function initModels(
  logger = new Logger(),
  storageDir = path.join(dataDir, "models"),
) {
  await fs.promises.mkdir(storageDir, { recursive: true });

  // VAD model
  const vadPath = path.join(storageDir, "silero_vad.onnx");
  if (!fs.existsSync(vadPath)) {
    logger.quiet(`Downloading VAD model to ${vadPath}...`);
    await download(VAD_MODEL_URL, vadPath);
  }

  // ASR model (tar.bz2) — extracts to sherpa-onnx-moonshine-tiny-en-int8/
  const asrDir = path.join(storageDir, "sherpa-onnx-moonshine-tiny-en-int8");
  if (!fs.existsSync(path.join(asrDir, "tokens.txt"))) {
    const tarball = path.join(storageDir, "moonshine-tiny-en.tar.bz2");
    if (!fs.existsSync(tarball)) {
      logger.quiet(`Downloading ASR model to ${tarball}...`);
      await download(ASR_MODEL_URL, tarball);
    }
    logger.quiet("Extracting ASR model...");
    await execa("tar", ["-xjf", tarball, "-C", storageDir]);
    fs.unlinkSync(tarball);
  }

  // Build VAD
  const vadConfig = {
    sileroVad: {
      model: vadPath,
      threshold: 0.5,
      minSilenceDuration: 0.5,
      minSpeechDuration: 0.25,
      windowSize: VAD_WINDOW_SIZE,
      maxSpeechDuration: 30,
    },
    sampleRate: TARGET_SAMPLE_RATE,
    numThreads: 1,
  };
  /** @type {VadType} */
  const vad = new sherpa.Vad(vadConfig, 120);

  // Build OfflineRecognizer (Moonshine)
  const recognizerConfig = {
    featConfig: {
      sampleRate: TARGET_SAMPLE_RATE,
      featureDim: 80,
    },
    modelConfig: {
      tokens: path.join(asrDir, "tokens.txt"),
      moonshine: {
        preprocessor: path.join(asrDir, "preprocess.onnx"),
        encoder: path.join(asrDir, "encode.int8.onnx"),
        uncachedDecoder: path.join(asrDir, "uncached_decode.int8.onnx"),
        cachedDecoder: path.join(asrDir, "cached_decode.int8.onnx"),
      },
      numThreads: 1,
      provider: "cpu",
    },
  };
  /** @type {RecognizerType} */
  const recognizer = new sherpa.OfflineRecognizer(recognizerConfig);

  return { vadPath, asrDir, vad, recognizer };
}

/**
 * Download a URL to a file.
 * @param {string} url
 * @param {string} dest
 */
async function download(url, dest) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(dest, buffer);
}
