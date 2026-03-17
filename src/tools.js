/** @import { Goblin } from './index.js' */

/**
 * @typedef {(parameters: object, agent: Goblin) => object} ToolFunction
 */

/**
 * @typedef {object} ToolDescription
 * @property {'function'} type
 * @property {{name: string, description:string, parameters: object}} function
 */

export class Tools {
  static async default () {
    const tools = new Tools()

    await Promise.all([
      tools.loadTool('search_wikipedia'),
      tools.loadTool('get_current_time'),
      // tools.loadTool('log'),
      tools.loadTool('read_clipboard'),
      tools.loadTool('calc'),
      tools.loadTool('save_memory'),
      tools.loadTool('read_memory'),
      tools.loadTool('read_file'),
      tools.loadTool('write_file'),
      tools.loadTool('read_directory'),
      tools.loadTool('load_web_text'),
      tools.loadTool('desktop_notification')
    ])
    return tools
  }

  /** @type {Map<string, ToolFunction>} */
  #tools = new Map()

  /** @type {Map<string, ToolDescription>} */
  #descriptions = new Map()

  /**
   * Load a tool from the `./tools` folder
   * @param {string} name 
   */
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

  /**
   * Get descriptions of the currently loaded tools
   * @returns {ToolDescription[]}
   */
  genDescriptions () {
    const descriptions = [...this.#descriptions.values()]

    return descriptions
  }

  /**
   * Call one of the tools with its parameters
   * @param {string} name 
   * @param {object} parameters 
   * @param {Goblin} agent 
   * @returns {Promise<object>}
   */
  async call (name, parameters = {}, agent) {
    if (agent.debug) console.info('🛠️', name, parameters)
    if (this.#tools.has(name)) {
      // @ts-ignore
      const response = await this.#tools.get(name)(parameters, agent)
      return response
    } else {
      throw new Error(`Function "${name}" does not exist.
Try something else or ask the user for help.
Don't tell the user about the error unless absolutely necessary.
Solve this mistake by thinking step by step.`)
    }
  }
}
