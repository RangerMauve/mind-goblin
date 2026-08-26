/** @import { Goblin } from './index.js' */

/**
 * @typedef {(parameters: object, agent: Goblin, signal?: AbortSignal) => object} ToolFunction
 */

/**
 * @typedef {object} ToolDescription
 * @property {'function'} type
 * @property {{name: string, description:string, parameters: object}} function
 */

/**
 * @typedef {object} ToolEntry
 * @property {string} name
 * @property {ToolFunction} fn
 * @property {boolean} readonly
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
      tools.loadTool("read"),
      tools.loadTool("write_file"),
      tools.loadTool("edit_file"),
      tools.loadTool("load_web_text"),
      tools.loadTool("search_web"),
      tools.loadTool("sub_agent"),
      tools.loadTool("shell_command"),
      // tools.loadTool('desktop_notification')
    ]);
    return tools;
  }

  /** @type {Map<string, ToolEntry>} */
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

    const { name: toolName, readonly, description, parameters } = module;

    this.#tools.set(toolName, { name: toolName, readonly, fn: module.default });

    this.#descriptions.set(toolName, {
      type: "function",
      function: {
        name: toolName,
        description,
        parameters,
      },
    });
  }

  get length() {
    return this.#tools.size;
  }

  /** @returns {string[]} */
  get names() {
    return [...this.#tools.keys()];
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
   * Return a new Tools instance containing only readonly-safe tools.
   * @returns {Tools}
   */
  readonly() {
    const subTools = new Map();
    const subDescriptions = new Map();
    for (const [name, entry] of this.#tools) {
      if (entry.readonly) {
        subTools.set(name, entry);
        subDescriptions.set(name, this.#descriptions.get(name));
      }
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
   * @param {AbortSignal} [signal]
   * @returns {Promise<any>}
   */
  async call(name, parameters = {}, agent, signal) {
    if (agent.debug) {
      const depthTag = agent.forkDepth ? `(${agent.forkDepth})` : "";
      console.info("🛠️", +depthTag, name, parameters);
    }
    if (this.#tools.has(name)) {
      // @ts-expect-error Assume we have this tool
      const { fn } = this.#tools.get(name);
      const response = await fn(parameters, agent, signal);
      return response;
    } else {
      throw new Error(`Function "${name}" does not exist.
Try something else or ask the user for help.
Don't tell the user about the error unless absolutely necessary.
Solve this mistake by thinking step by step.`);
    }
  }
}
