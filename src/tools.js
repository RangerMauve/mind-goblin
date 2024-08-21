export const TOOL_CALL_START = '<tool_call>'
export const TOOL_CALL_END = '</tool_call>'
export const TOOL_RESPONSE_START = '<tool_response>'
export const TOOL_RESPONSE_END = '</tool_response>'
export const TOOL = 'tool_response'

const POST_TOOL = '\nHas the action completed my goal? If not, re-evaluate the steps needed for resolution. Based on that, reply to the user or proceed accordingly.'

export class Tools {
  static async default () {
    const tools = new Tools()

    await Promise.all([
      // tools.loadTool('search_wikipedia'),
      tools.loadTool('get_current_time'),
      // tools.loadTool('log'),
      tools.loadTool('read_clipboard'),
      tools.loadTool('calc'),
      tools.loadTool('desktop_notification')
    ])
    return tools
  }

  #tools = null
  #descriptions = null
  constructor () {
    this.#tools = new Map()
    this.#descriptions = new Map()
  }

  async loadTool (name) {
    const module = await import(`./tools/${name}.js`)

    this.#tools.set(name, module.default)

    const { description, parameters } = module

    this.#descriptions.set(name, {
      type: 'function',
      function: {
        name,
        description,
        parameters
      }
    })
  }

  get length () {
    return this.#tools.size
  }

  genSystemPrompt (systemPrompt = '', tools = [...this.#tools.keys()]) {
    if (!this.length) {
      return systemPrompt
    }
    const descriptions = tools.map((name) => this.#descriptions.get(name))

    return `${systemPrompt}
To solve tasks, I can use predefined tools and execute their described actions in sequence. For each action, I must:

1. Clearly describe my thought process step by step using simple language.
2. Call a tool only when necessary to perform an action.
3. Wait for the result before proceedining with any further actions.
4. Continue this until providing the user with a final answer.
5. Record each function call in a JSON format within <tool_call> tags, like so:
    \`\`\`json
    <tool_call>{"name":"functionName","parameters":{"argument1":"value1", "argument2":"value2"}}</tool_call>
    \`\`\`
6. After using a tool, I will receive the result in a format:
    \`\`\`json
    <tool_response>"Response JSON here."</tool_response>
    \`\`\`
7. Present my answer concisely.

Here is my list of tools:
${JSON.stringify(descriptions)}
`

    //     return `${systemPrompt}You are able to call external functions to complete tasks.
    // Before calling a function, think step by step in plain language.
    // Once you call a function wait for a response before calling another one.
    // Keep going until you have an answer for the user.
    // Here are the available tools, you can only use functions described in this list:
    // <tools>${JSON.stringify(descriptions)}</tools>
    // For each function call return a json object with function name and arguments within <tool_call></tool_call> XML tags as follows:
    // <tool_call>
    // {"name":"example","parameters":{"query":"example query"}}
    // </tool_call>
    // You will then get a response in the following format:
    // <tool_response>
    // "Response JSON here."
    // </tool_response>
    // Be as concise as possible with your answer. Limit to just a few words when possible.
    // Do not tell the user about function calls or how you used them to derive the answer.
    // Only call functions if they are absolutely needed.`
  }

  async call (name, parameters = {}) {
    if (this.#tools.has(name)) {
      const response = await this.#tools.get(name)(parameters)
      return response
    } else {
      throw new Error(`Function "${name}" does not exist.
Try something else or ask the user for help.
Don't tell the user about the error unless absolutely necessary.
Solve this mistake by thinking step by step.`)
    }
  }
}

export function exists (answer) {
  return answer.includes(TOOL_CALL_START)
}

export function parse (answer) {
  const description = answer.slice(
    answer.indexOf(TOOL_CALL_START) + TOOL_CALL_START.length,
    answer.indexOf(TOOL_CALL_END)
  )

  return JSON.parse(description)
}

export function sanitize (answer) {
  // If it tries to call multiple tools, ignore the last ones.
  while (answer.indexOf(TOOL_CALL_START) !== answer.lastIndexOf(TOOL_CALL_START)) {
    answer = answer.slice(0, answer.lastIndexOf(TOOL_CALL_START))
  }

  // Ignore anything after the first tool call
  if (answer.includes(TOOL_CALL_END)) {
    answer = answer.slice(0, answer.indexOf(TOOL_CALL_END) + TOOL_CALL_END.length)
  }

  return answer
}

export function formatResponse (response) {
  return `${JSON.stringify(response)}\n${POST_TOOL}`
}
