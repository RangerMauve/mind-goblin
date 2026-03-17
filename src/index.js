import envPaths from 'env-paths'
import Database from 'better-sqlite3'
import FactMemory from 'fact-memory'

import { Tools } from './tools.js'

const STORAGE_PATH = envPaths('mind-goblin').data

const OLLAMA_SERVER = 'http://localhost:11434'
const REQUEST_TIMEOUT = 60 * 1000

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
const PRE_REPLY = ''

export const SYSTEM = 'system'
export const USER = 'user'
export const ASSISTANT = 'assistant'
export const TOOL = 'tool'

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
    return this.memory.recall({ tags: ['instructions'] }).map(({ fact }) => fact).join('\n')
  }

  async query (prompt, history) {
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
      { role: USER, content: prompt },
      { role: ASSISTANT, content: PRE_REPLY }
    )

    const tools = this.tools.genDescriptions()

    let result = await chat({ messages, tools })

    // Remove the pre-reply text
    messages.pop()
    while (result.tool_calls?.length) {
      messages.push(result)
      for (const call of result.tool_calls) {
        try {
          const result = await this.tools.call(call.function.name, call.function.arguments, this)
          messages.push({
            role: TOOL,
            content: JSON.stringify(result),
            name: call.function.name,
            tool_call_id: call.id
          })
        } catch (e) {
          messages.push({
            role: TOOL,
            content: `Unable to call tool ${call.name}: ${e.message}`,
            name: call.function.name
          })
        }
      }

      console.log(messages)
      result = await chat({ messages, tools })
    }

    return result.content
  }
}

async function chat ({ messages = {}, tools }) {
  const { message } = await postOllama('/api/chat', {
    model: MODEL,
    stream: false,
    think: false,
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

async function postOllama (path, body) {
  const url = new URL(path, OLLAMA_SERVER).href

  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    timeout: REQUEST_TIMEOUT
  })
  if (!response.ok) {
    throw new Error(await response.text())
  }
  return await response.json()
}
