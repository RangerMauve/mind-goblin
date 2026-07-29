import path from 'node:path'
import { Agent } from 'undici'
import rc from 'rc'
import _xdg from 'xdg-portable'

const xdg = /** @type {@import('xdg-portable').XDG} */(/** @type {unknown} */(_xdg))

// Default config for OpenAI-compatible API (Ollama default)
const DEFAULT_CONFIG = {
  model: 'qwen3.5:4b',
  server: 'http://localhost:11434/v1/',
  api_key: process.env.OPENAI_API_KEY || ''
}

export const APPNAME = 'mindgoblin'

// Load config from ~/.mindgoblinrc
const conf = rc(APPNAME, DEFAULT_CONFIG)
export const configDir = path.join(xdg.config(), APPNAME)
export const dataDir = path.join(xdg.data(), APPNAME)
export const sessionFolder = path.join(dataDir, 'sessions')

// Apply config to constants
const MODEL = conf.model
const SERVER = conf.server
const API_KEY = conf.api_key
const REQUEST_TIMEOUT = 30 * 60 * 1000

const agent = new Agent({
  connect: { timeout: REQUEST_TIMEOUT },
  headersTimeout: REQUEST_TIMEOUT,
  bodyTimeout: REQUEST_TIMEOUT
})

/**
 * @param {object} options
 * @param {import('./index.js').Message[]} options.messages
 * @param {import('./tools.js').ToolDescription[]} options.tools
 * @returns {Promise<import('./index.js').AssistantMessage>}
 */
export async function chat ({ messages = [], tools }) {
  const body = {
    model: MODEL,
    messages,
    tools,
    temperature: 0.6,
    top_p: 0.95
  }

  const result = await postOpenAI('chat/completions', body)

  return result.choices[0].message
}

/**
 * Send data to OpenAI-compatible API
 * @param {string} path
 * @param {object} data
 * @returns
 */
async function postOpenAI (path, data) {
  const url = (SERVER.endsWith('/') ? SERVER : SERVER + '/') + path

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + API_KEY
    },
    body: JSON.stringify(data),
    // @ts-ignore
    dispatcher: agent
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error (${response.status}): ${await response.text()}`)
  }
  return await response.json()
}
