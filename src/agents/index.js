import { SYSTEM, USER, ASSISTANT, generate } from '../inference.js'
import { TOOL, Tools, exists, formatResponse, parse, sanitize } from '../tools.js'

export const DEFAULT_PROMPT = 'You are a helpful AI assistant.'

export class Agent {
  #systemPrompt = ''
  constructor (systemPrompt = DEFAULT_PROMPT, tools = new Tools()) {
    this.#systemPrompt = systemPrompt
    this.tools = tools
    this.debug = false
  }

  async query (prompt, history) {
    const systemPrompt = this.tools.genSystemPrompt(this.#systemPrompt)
    const messages = [{
      role: SYSTEM,
      content: systemPrompt
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
    while (exists(answer)) {
      answer = sanitize(answer)
      messages.push({ role: ASSISTANT, content: answer })

      if (this.debug) console.log(messages)

      try {
        const { name, parameters } = parse(answer)
        if (this.debug) console.log(`(( calling ${name}${JSON.stringify(parameters)} ))`)
        const response = await this.tools.call(name, parameters)
        if (this.debug) console.log({ response })
        messages.push({
          role: TOOL,
          content: formatResponse(response)
        })
      } catch (e) {
        messages.push({
          role: TOOL,
          content: formatResponse(`Unable to invoke tool:\n${e.message}`)
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
