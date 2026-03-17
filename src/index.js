import {Agent} from "undici"
import envPaths from 'env-paths'
import Database from 'better-sqlite3'
import FactMemory from 'fact-memory'

import { Tools } from './tools.js'

/** @import {FunctionCall} from './tools.js' */

/** @typedef {{role: 'user', content: string}} UserMessage */
/** @typedef {{role: 'system', content: string}} SystemMessage */
/** @typedef {{role: 'assistant', content: string, thinking?: string, tool_calls?: FunctionCall[]}} AssistantMessage */
/** @typedef {{role: 'tool', content: string, name: string, tool_call_id?: string}} ToolMessage */

/**
 * @typedef {SystemMessage|UserMessage|AssistantMessage|ToolMessage} Message
 */

const STORAGE_PATH = envPaths('mind-goblin').data

const OLLAMA_SERVER = 'http://localhost:11434'
const REQUEST_TIMEOUT = 30 * 60 * 1000

// export const MODEL = 'huggingface.co/janhq/Jan-v1-edge-gguf:latest'
// export const MODEL = 'qwen2.5-coder:7b'
export const MODEL = 'qwen3.5:4b'

const DEFAULT_SYSTEM = `You are Mind Goblin.
An evil stooge that will do anything its master wants.
You are talking to your master who is named ${process.env.USER}.
Before calling any tools, think step by step on how to solve the user's query.
When you get a tool call response, use it to answer the users question or call another tool.
Only use tools if you really need to. Otherwise respond directly.
Be concise and direct in your responses. Respond without unnecessary explanation.
`

export const SYSTEM = 'system'
export const USER = 'user'
export const ASSISTANT = 'assistant'
export const TOOL = 'tool'
export const THINK_START = '<think>'
export const THINK_END = '</think>'

export class Goblin {
  static async fromOptions ({ storagePath = STORAGE_PATH, ...args }) {
    const tools = await Tools.default()
    return new Goblin({ tools, storagePath, ...args })
  }

  constructor ({
    tools = new Tools(),
    storagePath = STORAGE_PATH,
    debug = true
  }) {
    this.tools = tools
    const db = new Database(storagePath)
    const memory = new FactMemory(db)
    this.db = db
    this.memory = memory
    this.debug = debug
  }

  #getMemoryInstructions () {
    // @ts-ignore
    return this.memory.recall({ tags: ['instructions'] }).map(({ fact }) => fact).join('\n')
  }

  /**
   * Send a prompt to the agent and get a response. This triggers an agentic loop which can do tool calls.
   * @param {string} prompt
   * @param {object} [options]
   * @param {Message[]} [options.history] Optionally pass in an existing history to add the conversation to.
   * @param {(message: string) => void} [options.onprogress] Optionally pass in a callback to call as there is progress on the task
   * @returns
   */
  async query (prompt, {history, onprogress} = {}) {
    // Use existing history or start a new one
    const messages = history ? history.slice() : []

    // Add in system prompt if it isn't set
    if (!messages[0] || messages[0].role !== SYSTEM) {
      const content = DEFAULT_SYSTEM + this.#getMemoryInstructions()
      messages.unshift(
        { role: SYSTEM, content }
      )
    }

    // Fill in prompt and pre-reply
    messages.push(
      { role: USER, content: prompt }
    )

    const tools = this.tools.genDescriptions()

    let result = await chat({ messages, tools })

    while (result.tool_calls?.length) {
      if(onprogress) {
        const {content} = result
        const stripped = stripThinking(content)
        if(stripped) onprogress(stripped)
      }
      messages.push(result)
      for (const call of result.tool_calls) {
        try {
          const toolContent = await this.tools.call(call.function.name, call.function.arguments, this)
          messages.push({
            role: TOOL,
            content: JSON.stringify(toolContent),
            name: call.function.name,
            tool_call_id: call.id
          })
        } catch (e) {
          messages.push({
            role: TOOL,
            content: `Unable to call tool ${call.function.name}: ${e.message}`,
            name: call.function.name,
            tool_call_id: call.id
          })
        }
      }

      console.log(messages)
      result = await chat({ messages, tools })
    }

    return result.content
  }
}

/**
 * @param {object} options
 * @param {Message[]} options.messages
 * @param {import('./tools.js').ToolDescription[]} options.tools
 * @returns {Promise<AssistantMessage>}
 */
async function chat ({ messages = [], tools }) {
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

const agent = new Agent({
  connect: { timeout: REQUEST_TIMEOUT },
  headersTimeout: REQUEST_TIMEOUT,
  bodyTimeout: REQUEST_TIMEOUT
})

/**
 * Send data to ollama
 * @param {string} path
 * @param {object} body
 * @returns
 */
async function postOllama (path, body) {
  const url = new URL(path, OLLAMA_SERVER).href

  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
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
export function stripThinking(content) {
  if(content.includes(THINK_START)) {
    const thinkEnd = content.indexOf(THINK_END)
    if(thinkEnd > 0) {
      return content.slice(thinkEnd + THINK_END.length)
    }
  }
  return content.trim()
}