import * as tools from './tools.js'
import { TOOL } from './tools.js'
import { SYSTEM, ASSISTANT, USER, generate } from './inference.js'

const DEFAULT_SYSTEM_PROMPT = "I am an advanced AI assistant."

await Promise.all([
  // tools.loadTool('search_wikipedia'),
  tools.loadTool('get_current_time'),
  // tools.loadTool('log'),
  tools.loadTool('read_clipboard'),
  tools.loadTool('calc'),
  tools.loadTool('desktop_notification')
])

const SYSTEM_PROMPT = tools.genSystemPrompt()

export class Goblin {
  static default () {
    return new Goblin(tools.genSystemPrompt())
  }

  static fromOptions ({ system = DEFAULT_SYSTEM_PROMPT, debug = false }) {
    const goblin = new Goblin(tools.genSystemPrompt(system))

    if (debug) {
      goblin.debug = true
    }

    return goblin
  }

  #systemPrompt = ''
  constructor (systemPrompt) {
    this.#systemPrompt = systemPrompt
    this.debug = false
  }

  async query (prompt, history) {
    const messages = [{
      role: SYSTEM,
      content: SYSTEM_PROMPT
    }]

    if (history) {
      messages.push(...history)
    }

    // Before prompting, have it explain it's capabilities and instructions
    // This was pre-generated from phi-3
    /*
    messages.push({
      role: USER,
      content: "In your own words using plain language, without using tool calls, describe the above. Focus on what you can do, and what you should not do."
    }, {
      role: ASSISTANT,
      content: `You can use specific tools to perform certain tasks based on user requests. For example:

1. If a user asks for the current time, call 'get_current_time' without any arguments.
2. When asked to display a notification message on their desktop with a given text, use 'desktop_notification' and provide the message as an argument.
3. To perform calculations like multiplication or currency conversion, utilize 'calc' by passing a math expression as an argument.
4. If someone wants you to read from their clipboard but hasn't provided any text, invoke 'read_clipboard' without arguments.

Avoid using these tools for unrelated tasks and ensure that each function is used only when necessary according to the user's request`
    })
    */

    messages.push({
      role: USER,
      content: prompt
    })

    let answer = (await generate(messages)).trim()

    // TODO: Handle multi calls
    while (tools.exists(answer)) {
      answer = tools.sanitize(answer)
      messages.push({ role: ASSISTANT, content: answer })

      if (this.debug) console.log(messages)

      try {
        const { name, parameters } = tools.parse(answer)
        if (this.debug) console.log(`(( calling ${name}${JSON.stringify(parameters)} ))`)
        const response = await tools.call(name, parameters)
        if (this.debug) console.log({ response })
        messages.push({
          role: TOOL,
          content: tools.formatResponse(response)
        })
      } catch (e) {
        messages.push({
          role: TOOL,
          content: tools.formatResponse(`Unable to invoke tool:\n${e.message}`)
        })
        if (this.debug) console.error(e.stack)
      }

      const final = await generate(messages)

      answer = final.trim()

      if (this.debug) console.log({ answer })
    }

    return answer
  }
}