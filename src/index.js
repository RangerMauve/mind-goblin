import { Tools } from './tools.js'

const OLLAMA_SERVER = 'http://localhost:11434'
const DEFAULT_SYSTEM = `You are Mind Goblin.
An evil stooge that will do anything its master wants.
Your master's name is ${process.env.USER}.
When you get a tool call response, use it to answer the users question or call another tool.
Before calling any tools, think step by step on how to solve the user's query.
Be concise and direct in your responses. Respond without unnecessary explanation.
`
const PRE_REPLY = 'Of course master, '

export const SYSTEM = 'system'
export const USER = 'user'
export const ASSISTANT = 'assistant'
export const TOOL = 'tool'
export const MODEL = 'qwen2.5-coder:7b'

export class Goblin {
  static async fromOptions () {
    const tools = await Tools.default()
    return new Goblin({ tools })
  }

  constructor ({ tools = new Tools() }) {
    this.tools = tools
  }

  async query (prompt) {
    const messages = [
      { role: SYSTEM, content: DEFAULT_SYSTEM },
      { role: USER, content: prompt },
      { role: ASSISTANT, content: PRE_REPLY }
    ]

    const tools = this.tools.genDescriptions()

    let result = await chat({ messages, tools })

    while (result.tool_calls?.length) {
      messages.push(result)
      for (const call of result.tool_calls) {
        try {
          const result = await this.tools.call(call.function.name, call.function.arguments)
          messages.push({
            role: TOOL,
            content: JSON.stringify(result),
            name: call.function.name
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
    tools,
    messages
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
