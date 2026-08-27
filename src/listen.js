import fs from "node:fs";
import path from "node:path";
import { execa } from "execa";
import cpal from "node-cpal";
import sherpa from "sherpa-onnx-node";

import { USER, Goblin } from "./index.js";
import { Sessions } from "./sessions.js";
import { sessionFolder, dataDir, conf } from "./utils.js";
import speakTool from "./tools/speak.js";
import { INFO, QUIET, ALERT, color } from "./ansi.js";

/** @import {Message} from "./index.js" */
/** @typedef {import("sherpa-onnx-node").Vad} VadType */
/** @typedef {import("sherpa-onnx-node").OfflineRecognizer} RecognizerType */
/** @typedef {import("sherpa-onnx-node").LinearResampler} ResamplerType */

const TARGET_SAMPLE_RATE = 16000;
const VAD_WINDOW_SIZE = 512; // 32ms at 16kHz

export const MODELS_BASE =
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models";
export const VAD_MODEL_URL = `${MODELS_BASE}/silero_vad.onnx`;
export const ASR_MODEL_URL = `${MODELS_BASE}/sherpa-onnx-moonshine-tiny-en-int8.tar.bz2`;

/**
 * @param {object} options
 * @param {string} [options.session] Session name
 * @param {boolean} [options.clear] Clear session before starting
 * @param {boolean} [options.speak] Speak responses aloud
 */
export async function listen(options) {
  const {
    session,
    clear,
    speak: doSpeak = true,
    ...goblinOpts
  } = {
    ...conf,
    ...options,
  };

  // 1. Ensure models exist + build VAD + recognizer
  const { vad, recognizer } = await initModels();

  // 2. Setup goblin session
  const goblin = await Goblin.fromOptions({ ...goblinOpts });
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

  console.log(color(INFO, "Listening... (Ctrl+C to stop)"));

  // 7. Graceful shutdown
  process.on("SIGINT", () => controller.abort());
  // Stream: audio → transcribed lines → goblin
  const audio = openMic(resampler, controller.signal);
  const lines = processAudio(audio, vad, recognizer, controller.signal);

  let abortLast = new AbortController();

  /** @param {AbortSignal} signal */
  async function crank(signal) {
    try {
      const response = await goblin.crank(messages, {
        signal,
      });
      if (controller.signal.aborted || signal.aborted) return;

      logOutgoing(response.content);

      if (doSpeak) {
        await speakTool(
          { message: response.content.trim().replaceAll("\n", " ") },
          goblin,
          signal,
        );
      }
    } catch (e) {
      console.error(
        color(ALERT, `Goblin error: ${/** @type {Error} */ (e).message}`),
      );
    }
    if (controller.signal.aborted || signal.aborted) return;

    await session_.save(messages);
  }

  for await (const text of lines) {
    logIncoming(text);

    messages.push({ role: USER, content: text });

    // interrupt whatever it was doing to focus on the new message
    abortLast.abort();
    abortLast = new AbortController();
    crank(abortLast.signal);
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
 * @param {string} [storageDir] Directory to store models. Defaults to dataDir/models.
 * @returns {Promise<{vadPath: string, asrDir: string, vad: VadType, recognizer: RecognizerType}>}
 */
export async function initModels(storageDir = path.join(dataDir, "models")) {
  await fs.promises.mkdir(storageDir, { recursive: true });

  // VAD model
  const vadPath = path.join(storageDir, "silero_vad.onnx");
  if (!fs.existsSync(vadPath)) {
    console.log(color(QUIET, `Downloading VAD model to ${vadPath}...`));
    await download(VAD_MODEL_URL, vadPath);
  }

  // ASR model (tar.bz2) — extracts to sherpa-onnx-moonshine-tiny-en-int8/
  const asrDir = path.join(storageDir, "sherpa-onnx-moonshine-tiny-en-int8");
  if (!fs.existsSync(path.join(asrDir, "tokens.txt"))) {
    const tarball = path.join(storageDir, "moonshine-tiny-en.tar.bz2");
    if (!fs.existsSync(tarball)) {
      console.log(color(QUIET, `Downloading ASR model to ${tarball}...`));
      await download(ASR_MODEL_URL, tarball);
    }
    console.log(color(QUIET, "Extracting ASR model..."));
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
  const vad = new sherpa.Vad(vadConfig, 60);

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

/** @param {string} text */
function logIncoming(text) {
  const ts = new Date().toLocaleTimeString();
  console.log(color(INFO, `[${ts}] 🎤 USER: ${text}`));
}

/** @param {string} text */
function logOutgoing(text) {
  const ts = new Date().toLocaleTimeString();
  console.log(color(QUIET, `[${ts}] 👺 GOBLIN: ${text}`));
}
