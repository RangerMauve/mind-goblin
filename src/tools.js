/** @import { Goblin } from './index.js' */

/**
 * @typedef {(parameters: object, agent: Goblin) => object} ToolFunction
 */

/**
 * @typedef {object} ToolDescription
 * @property {'function'} type
 * @property {{name: string, description:string, parameters: object}} function
 */

/**
 * @typedef {object} FunctionCall
 * @property {'function'} type
 * @property {object} function
 * @property {string} function.name
 * @property {string} function.arguments
 * @property {string} [id]
 */

export class Tools {
  static async default() {
    const tools = new Tools();

    await Promise.all([
      tools.loadTool("get_current_time"),
      tools.loadTool("read_clipboard"),
      tools.loadTool("read_file"),
      tools.loadTool("write_file"),
      tools.loadTool("edit_file"),
      tools.loadTool("read_directory"),
      tools.loadTool("load_web_text"),
      tools.loadTool("search_web"),
      tools.loadTool("sub_agent"),
      tools.loadTool("shell_command"),
      // tools.loadTool('desktop_notification')
    ]);
    return tools;
  }

  /** @type {Map<string, ToolFunction>} */
  #tools;

  /** @type {Map<string, ToolDescription>} */
  #descriptions;

  constructor(tools = new Map(), descriptions = new Map()) {
    this.#tools = tools;
    this.#descriptions = descriptions;
  }

  /**
   * Load a tool from the `./tools` folder
   * @param {string} name
   */
  async loadTool(name) {
    const module = await import(`./tools/${name}.js`);

    this.#tools.set(name, module.default);

    const { description, parameters } = module;

    this.#descriptions.set(name, {
      type: "function",
      function: {
        name,
        description,
        parameters,
      },
    });
  }

  get length() {
    return this.#tools.size;
  }

  /**
   * Create a subset of tools based on an allow list
   * @param {string[]} limitTools
   */
  subset(limitTools) {
    const subTools = new Map();
    const subDescriptions = new Map();
    for (const name of limitTools) {
      if (!this.#tools.has(name))
        throw new Error(`Unknown tool ${name}. Try again without it.`);
      subTools.set(name, this.#tools.get(name));
      subDescriptions.set(name, this.#descriptions.get(name));
    }
    return new Tools(subTools, subDescriptions);
  }

  /**
   * Get descriptions of the currently loaded tools
   * @returns {ToolDescription[]}
   */
  genDescriptions() {
    const descriptions = [...this.#descriptions.values()];

    return descriptions;
  }

  /**
   * Call one of the tools with its parameters
   * @param {string} name
   * @param {object} parameters
   * @param {Goblin} agent
   * @returns {Promise<any>}
   */
  async call(name, parameters = {}, agent) {
    if (agent.debug) {
      const depthTag = agent.forkDepth ? `(${agent.forkDepth})` : "";
      console.info("🛠️", +depthTag, name, parameters);
    }
    if (this.#tools.has(name)) {
      // @ts-expect-error Assume we have this tool
      const response = await this.#tools.get(name)(parameters, agent);
      return response;
    } else {
      throw new Error(`Function "${name}" does not exist.
Try something else or ask the user for help.
Don't tell the user about the error unless absolutely necessary.
Solve this mistake by thinking step by step.`);
    }
  }
}
