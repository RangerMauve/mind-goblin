import path from "node:path";
import { Agent } from "undici";
import rc from "rc";
import _xdg from "xdg-portable";

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
 */

// Default config for OpenAI-compatible API (Ollama default).
// Sampling params are intentionally unset so the provider's defaults apply.
const DEFAULT_CONFIG = {
  model: "qwen3.5:4b",
  server: "http://localhost:11434/v1/",
  api_key: process.env.OPENAI_API_KEY || "",
  readonly: false,
};

export const APPNAME = "mindgoblin";

// Load config from ~/.mindgoblinrc
export const conf = /** @type {Config} */ (rc(APPNAME, DEFAULT_CONFIG));
export const configDir = path.join(xdg.config(), APPNAME);
export const dataDir = path.join(xdg.data(), APPNAME);
export const sessionFolder = path.join(dataDir, "sessions");

// Apply config to constants
const MODEL = conf.model;
const SERVER = conf.server;
const API_KEY = conf.api_key;
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
 * @param {import('./index.js').Message[]} options.messages
 * @param {import('./tools.js').ToolDescription[]} options.tools
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<import('./index.js').AssistantMessage>}
 */
export async function chat({ messages = [], tools, signal }) {
  /** @type {Record<string, unknown>} */
  const body = { model: MODEL, messages, tools };
  for (const key of SAMPLING_PARAMS) body[key] = conf[key];

  const result = await postOpenAI("chat/completions", body, signal);

  return result.choices[0].message;
}

/**
 * Send data to OpenAI-compatible API
 * @param {string} path
 * @param {object} data
 * @param {AbortSignal} [signal]
 * @returns
 */
async function postOpenAI(path, data, signal) {
  const url = (SERVER.endsWith("/") ? SERVER : SERVER + "/") + path;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + API_KEY,
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
