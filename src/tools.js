export class Tools {
  static async default () {
    const tools = new Tools()

    await Promise.all([
      // tools.loadTool('search_wikipedia'),
      tools.loadTool('get_current_time'),
      // tools.loadTool('log'),
      tools.loadTool('read_clipboard'),
      tools.loadTool('calc')
      // tools.loadTool('desktop_notification')
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

  genDescriptions () {
    const descriptions = [...this.#descriptions.values()]

    return descriptions
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
