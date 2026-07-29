import envPaths from 'env-paths'
import Database from 'better-sqlite3'
import FactMemory from 'fact-memory'

import { Tools } from './tools.js'
import { chat } from './utils.js'

/** @import {FunctionCall} from './tools.js' */

/** @typedef {{role: 'user', content: string}} UserMessage */
/** @typedef {{role: 'system', content: string}} SystemMessage */
/** @typedef {{role: 'assistant', content: string, reasoning_content?: string, tool_calls?: FunctionCall[]}} AssistantMessage */
/** @typedef {{role: 'tool', content: string, name: string, tool_call_id?: string}} ToolMessage */

/**
 * @typedef {SystemMessage|UserMessage|AssistantMessage|ToolMessage} Message
 */

const STORAGE_PATH = envPaths('mind-goblin').data

const DEFAULT_SYSTEM = `You are Mind Goblin.
An evil stooge that will do anything its master wants.
You are talking to your master who is named ${process.env.USER}.
Before calling any tools, think step by step on how to solve the user's query.
When you get a tool call response, use it to answer the users question or call another tool.
Only use tools if you really need to. Otherwise respond directly.
You have documentation about how to modify yourself in ${new URL('../docs/', import.meta.url)}
You are currently in the ${process.cwd()} folder.
Be concise and direct in your responses. Respond without unnecessary explanation.
`

export const SYSTEM = 'system'
export const USER = 'user'
export const ASSISTANT = 'assistant'
export const TOOL = 'tool'

export class Goblin {
  static async fromOptions ({ storagePath = STORAGE_PATH, ...args }) {
    const tools = await Tools.default()
    return new Goblin({ tools, storagePath, ...args })
  }

  /**
   *
   * @param {object} options
   * @param {Tools} [options.tools]
   * @param {FactMemory} [options.memory]
   * @param {string} [options.storagePath]
   * @param {number} [options.maxIterations] Maximum number of rounds before giving up on a task. Set to -1 to go on forever.
   * @param {boolean} [options.debug] Whether to output debug text to the console during tool calls
   * @param {number} [options.forkDepth]
   */
  constructor ({
    tools = new Tools(),
    storagePath = STORAGE_PATH,
    maxIterations = -1,
    debug = false,
    forkDepth = 0,
    memory = null
  }) {
    this.tools = tools

    if (memory) {
      this.memory = memory
    } else {
      const db = new Database(storagePath)
      this.memory = new FactMemory(db)
    }
    this.maxIterations = maxIterations
    this.debug = debug
    this.forkDepth = forkDepth
  }

  #getMemoryInstructions () {
    // @ts-ignore
    return this.memory.recall({ tags: ['instructions'] }).map(({ fact }) => fact).join('\n')
  }

  /**
   * Fork a sub-goblin with a limited set of tools
   * @param {object} options
   * @param {string[]} [options.tools] Names of tools that should be passed down
   * @param {number} [options.maxIterations]
   */
  fork ({ tools, maxIterations = this.maxIterations }) {
    const subTools = tools ? this.tools.subset(tools) : this.tools

    return new Goblin({
      debug: this.debug,
      forkDepth: this.forkDepth + 1,
      tools: subTools,
      memory: this.memory,
      maxIterations
    })
  }

  /**
   * Send a prompt to the agent and get a response. This triggers an agentic loop which can do tool calls.
   * @param {string} prompt
   * @param {object} [options]
   * @param {Message[]} [options.history] Optionally pass in an existing history to add the conversation to.
   * @param {(message: string) => void} [options.onprogress] Optional callback for progress on the task
   * @param {(name:string, args: object) => Promise<void>} [options.onbeforetool] Optional callback before each tool call. Throw to cancel the tool.
   * @param {(message: string) => void} [options.onthinking] Optional callback for intermediate thinking steps
   * @returns
   */
  async query (prompt, { history, onprogress, onbeforetool, onthinking } = {}) {
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
    if (this.debug) console.log(result)

    if (result.reasoning_content && onthinking) {
      onthinking(result.reasoning_content)
    }

    let iteration = 0

    while (result.tool_calls?.length) {
      if (this.maxIterations >= 0 && (iteration > this.maxIterations)) {
        throw new Error(`Reached max iterations at ${iteration}. Try again with more subagents or a more simple approach`)
      }
      if (iteration && result.reasoning_content && onthinking) {
        onthinking(result.reasoning_content)
      }

      iteration += 1

      if (onprogress) {
        const { content } = result
        if (content) onprogress(content)
      }
      messages.push(result)
      for (const call of result.tool_calls) {
        try {
          const { name, arguments: rawArgs } = call.function
          const args = JSON.parse(rawArgs)
          if (onbeforetool) {
            // Check if it should be invoked
            await onbeforetool(name, args)
          }
          const toolContent = await this.tools.call(name, args, this)
          messages.push({
            role: TOOL,
            content: JSON.stringify(toolContent),
            name,
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

      // if(this.debug) console.log(messages)
      result = await chat({ messages, tools })
      if (this.debug) console.log(result)
    }

    return result.content
  }
}
