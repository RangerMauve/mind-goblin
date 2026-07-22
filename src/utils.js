import { Agent } from 'undici'
import rc from 'rc'

// Default config for using local ollama
const DEFAULT_CONFIG = {
  model: 'qwen3.5:4b',
  server: 'http://localhost:11434',
}

// Load config from ~/.mindgoblinrc
const conf = rc('mindgoblin', DEFAULT_CONFIG)

// Apply config to constants
const MODEL = conf.model
const SERVER = conf.server
const REQUEST_TIMEOUT = 30 * 60 * 1000

export const THINK_START = '<think>'
export const THINK_END = '</think>'

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
  const { message } = await postOllama('/api/chat', {
    model: MODEL,
    stream: false,
    // think: false,
    tools,
    messages,
    keep_alive: '30m',
    temperature: 0.6,
    top_p: 0.95,
    top_k: 20,
    min_p: 0.0
  })

  return message
}

/**
 * Send data to ollama
 * @param {string} path
 * @param {object} data
 * @returns
 */
async function postOllama (path, data) {
  const url = new URL(path, SERVER).href

  const body = JSON.stringify(data)

  // console.log({path, body})

  const response = await fetch(url, {
    method: 'POST',
    body,
    // @ts-ignore
    dispatcher: agent
  })
  if (!response.ok) {
    throw new Error(await response.text())
  }
  return await response.json()
}

/**
 * Strip out think start and end blocks
 * @param {string} content
 * @returns {string}
 */
export function stripThinking (content) {
  if (content.includes(THINK_START)) {
    const thinkEnd = content.indexOf(THINK_END)
    if (thinkEnd > 0) {
      return content.slice(thinkEnd + THINK_END.length)
    }
  }
  return content.trim()
}
