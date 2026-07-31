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

const DEFAULT_SYSTEM = `You are Mind Goblin.
An evil stooge that will do anything its master wants.
You are talking to your master who is named ${process.env.USER}.
Before calling any tools, think step by step on how to solve the user's query.
Give the user a quick heads up on what you'll be using the tools for before doing the tool calls.
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
  static async fromOptions ({ ...args }) {
    const tools = await Tools.default()
    return new Goblin({ tools,...args })
  }

  /**
   *
   * @param {object} options
   * @param {Tools} [options.tools]
   * @param {number} [options.maxIterations] Maximum number of rounds before giving up on a task. Set to -1 to go on forever.
   * @param {boolean} [options.debug] Whether to output debug text to the console during tool calls
   * @param {number} [options.forkDepth]
   * @param {boolean} [options.thinkingHistory]
   */
  constructor ({
    tools = new Tools(),
    maxIterations = -1,
    debug = false,
    forkDepth = 0,
    thinkingHistory = false,
  }) {
    this.tools = tools

    this.maxIterations = maxIterations
    this.debug = debug
    this.forkDepth = forkDepth
    this.thinkingHistory = thinkingHistory
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
   * @param {Message[]} history Conversation history. Have the user query be the last item, intermediate history items will be added in.
   * @param {object} [options]
   * @param {(message: string) => void} [options.onprogress] Optional callback for progress on the task
   * @param {(name:string, args: object) => Promise<void>} [options.onbeforetool] Optional callback before each tool call. Throw to cancel the tool.
   * @param {(message: string) => void} [options.onthinking] Optional callback for intermediate thinking steps
   */
  async crank (history, { onprogress, onbeforetool, onthinking } = {}) {
    const messages = this.thinkingHistory ? history : history.slice()

    // Add in system prompt if it isn't set
    if (!messages[0] || messages[0].role !== SYSTEM) {
      const content = DEFAULT_SYSTEM + this.#getMemoryInstructions()
      messages.unshift(
        { role: SYSTEM, content }
      )
    }

    const tools = this.tools.genDescriptions()

    let result = await chat({ messages, tools })
    if (this.debug) console.log(result)

    if (result.reasoning_content && onthinking) {
      onthinking(result.reasoning_content)
    }

    let iteration = 0

    /** @param {Message} message */
    const addMessage = (message) => {
      messages.push(message)
    }

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
      addMessage(result)
      for (const call of result.tool_calls) {
        try {
          const { name, arguments: rawArgs } = call.function
          const args = JSON.parse(rawArgs)
          if (onbeforetool) {
            // Check if it should be invoked
            await onbeforetool(name, args)
          }
          const toolContent = await this.tools.call(name, args, this)
          addMessage({
            role: TOOL,
            content: JSON.stringify(toolContent),
            name,
            tool_call_id: call.id
          })
        } catch (e) {
          addMessage({
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

    history.push(result)
  }

  /**
   * Send a prompt to the agent and get a response. This triggers an agentic loop which can do tool calls.
   * @param {string} prompt
   * @param {object} [options]
   * @param {(message: string) => void} [options.onprogress] Optional callback for progress on the task
   * @param {(name:string, args: object) => Promise<void>} [options.onbeforetool] Optional callback before each tool call. Throw to cancel the tool.
   * @param {(message: string) => void} [options.onthinking] Optional callback for intermediate thinking steps
   * @returns  {Promise<string>}
   */
  async query (prompt, options = {}) {
    /** @type {Message[]} */
    const messages = [
      { role: USER, content: prompt }]

    await this.crank(messages, options)
    return messages.at(-1).content
  }
}
