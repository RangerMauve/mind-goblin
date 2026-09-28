import fs from "node:fs/promises";
import path from "node:path";
import { Agent } from "undici";
import rc from "rc";
import _xdg from "xdg-portable";

/** @import {Message, AssistantMessage} from "./index.js" */
/** @import {ToolDescription} from "./tools.js" */

const xdg = /** @type {import('xdg-portable').XDG} */ (
  /** @type {unknown} */ (_xdg)
);

/**
 * Mindgoblin config, loaded from ~/.mindgoblinrc over the defaults below.
 *
 * Sampling params are optional: when unset they are not sent, so the
 * provider's own defaults apply.
 *
 * @typedef {Object} Config
 * @property {string} model - Model name to request.
 * @property {string} server - Base URL of the OpenAI-compatible API.
 * @property {string} api_key - Bearer token sent with each request.
 * @property {number} [temperature] - Sampling temperature.
 * @property {number} [top_p] - Nucleus sampling threshold.
 * @property {number} [top_k] - Candidates to keep per step (Ollama).
 * @property {number} [max_tokens] - Max tokens to generate.
 * @property {number} [frequency_penalty] - Penalty on tokens by existing frequency.
 * @property {number} [presence_penalty] - Penalty on tokens that already appear.
 * @property {string | string[]} [stop] - Sequences that stop generation.
 * @property {number} [seed] - Seed for reproducible sampling.
 * @property {boolean} [readonly] - When true, the goblin will not use write or edit tools.
 * @property {boolean} [allowLocal] - When true, auto-approve writes/edits within cwd.
 * @property {boolean} [agentsMd] - When true (default), load AGENTS.md from the working directory into the system prompt.
 * @property {string} [memoryFile] - Path to the persistent memory file. Defaults to MEMORY.md in the data dir.
 * @property {Record<string, Partial<Config>>} [models] - Named model presets. Top-level params are auto-copied into `models.default` on load.
 */

export const APPNAME = "mindgoblin";

// Default config for OpenAI-compatible API (Ollama default).
// Sampling params are intentionally unset so the provider's defaults apply.
const DEFAULT_CONFIG = {
  model: "qwen3.5:4b",
  server: "http://localhost:11434/v1/",
  api_key: process.env.OPENAI_API_KEY || "",
  readonly: false,
  allowLocal: false,
  agentsMd: true,
  memoryFile: path.join(xdg.data(), APPNAME, "MEMORY.md"),
};

// Load config from ~/.mindgoblinrc
export const conf = /** @type {Config} */ (rc(APPNAME, DEFAULT_CONFIG));

// Ensure models.default exists from top-level params
if (!conf.models) conf.models = {};
if (!conf.models.default) {
  const rest = { ...conf };
  delete rest.models;
  conf.models.default = rest;
}

export const configDir = path.join(xdg.config(), APPNAME);
export const dataDir = path.join(xdg.data(), APPNAME);
export const sessionFolder = path.join(dataDir, "sessions");
export const memoryFile = path.join(dataDir, "MEMORY.md");

/**
 * Read the persistent memory file.
 * @param {string} file - Path to the memory file
 * @returns {Promise<string>} The memory content, or empty string if the file doesn't exist.
 */
export async function loadMemory(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

const REQUEST_TIMEOUT = 30 * 60 * 1000;

const agent = new Agent({
  connect: { timeout: REQUEST_TIMEOUT },
  headersTimeout: REQUEST_TIMEOUT,
  bodyTimeout: REQUEST_TIMEOUT,
});

// Sampling params pulled from config; undefined values are dropped by JSON.stringify
/** @type {(keyof Config)[]} */
const SAMPLING_PARAMS = [
  "temperature",
  "top_p",
  "top_k",
  "max_tokens",
  "frequency_penalty",
  "presence_penalty",
  "stop",
  "seed",
];

/**
 * @param {object} options
 * @param {Message[]} options.messages
 * @param {ToolDescription[]} options.tools
 * @param {Config} options.config
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<AssistantMessage>}
 */
export async function chat({ messages = [], tools, signal, config }) {
  /** @type {Record<string, unknown>} */
  const body = { model: config.model, messages, tools };
  for (const key of SAMPLING_PARAMS) body[key] = config[key];

  const result = await postOpenAI("chat/completions", body, config, signal);

  return result.choices[0].message;
}

/**
 * Resolve a model preset name into a full config for API calls.
 * @param {string} [name] - Preset name from conf.models. Defaults to "default".
 * @returns {Config} The resolved config.
 */
export function resolveModel(name = "default") {
  const preset = conf.models?.[name];
  if (!preset) {
    const available = Object.keys(conf.models ?? {}).join(", ") || "(none)";
    throw new Error(`Unknown model "${name}". Available models: ${available}`);
  }
  return { ...conf, ...preset };
}

/**
 * Agent instruction files checked in priority order.
 */
const AGENTS_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "QWEN.md",
  "GEMINI.md",
  ".cursorrules",
];

/**
 * Load an agent instruction file from the given directory (defaults to cwd).
 * All files are read in parallel; the highest-priority existing file wins.
 * Returns an empty string if none exist.
 * @param {string} [dir] Directory to look for agent instruction files
 * @returns {Promise<string>}
 */
export async function loadAgentsMd(dir = process.cwd()) {
  const results = await Promise.allSettled(
    AGENTS_FILES.map((file) => fs.readFile(path.join(dir, file), "utf8")),
  );
  for (const result of results) {
    if (result.status === "fulfilled") return result.value;
  }
  return "";
}

/**
 * Send data to OpenAI-compatible API
 * @param {string} path
 * @param {object} data
 * @param {Config} config
 * @param {AbortSignal} [signal]
 * @returns
 */
async function postOpenAI(path, data, config, signal) {
  const server = config.server;
  const url = (server.endsWith("/") ? server : server + "/") + path;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + config.api_key,
    },
    body: JSON.stringify(data),
    signal,
    // @ts-expect-error This is a non standard property from nodejs
    dispatcher: agent,
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI API error (${response.status}): ${await response.text()}`,
    );
  }
  return await response.json();
}
