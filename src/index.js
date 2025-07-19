import envPaths from 'env-paths'
import Database from 'better-sqlite3'
import FactMemory from 'fact-memory'

import { Tools } from './tools.js'

const STORAGE_PATH = envPaths('mind-goblin').data

const OLLAMA_SERVER = 'http://localhost:11434'
const DEFAULT_SYSTEM = `You are Mind Goblin.
An evil stooge that will do anything its master wants.
You are talking to your master who is named ${process.env.USER}.
When you get a tool call response, use it to answer the users question or call another tool.
Before calling any tools, think step by step on how to solve the user's query.
Only use tools if you really need to. Otherwise respond directly.
Be concise and direct in your responses. Respond without unnecessary explanation.
`
const PRE_REPLY = 'Of course master, '

export const SYSTEM = 'system'
export const USER = 'user'
export const ASSISTANT = 'assistant'
export const TOOL = 'tool'
export const MODEL = 'qwen2.5-coder:7b'

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
      const timePrompt = `\nThe current time is ${getCurrentTimeAndDate()}`
      const content = DEFAULT_SYSTEM + this.#getMemoryInstructions() + timePrompt
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
    keep_alive: '30m'
  })

  return message
}

async function postOllama (path, body) {
  const url = new URL(path, OLLAMA_SERVER).href

  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body)
  })
  if (!response.ok) {
    throw new Error(await response.text())
  }
  return await response.json()
}

function getCurrentTimeAndDate() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // getMonth() is zero-indexed
    const day = String(now.getDate()).padStart(2, '0');

    const timeAndDate = `${hours}:${minutes}:${seconds} ${year}/${month}/${day}`;
    return timeAndDate;
}
