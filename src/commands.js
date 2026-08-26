/** @import {REPLContext} from "./repl.js"*/
/** @import {Goblin} from "./index.js"*/

/** @typedef {(line: string, context: REPLContext, agent: Goblin, signal?: AbortSignal)=> Promise<void> | void} RunCommand*/
/** @typedef {(prefix: string, context: REPLContext)=> Promise<string[]> | string[]} CompleteCommand*/

export class Commands {
  static async default() {
    const commands = new Commands();
    await commands.load("shell");
    await commands.load("compact");
    return commands;
  }

  /** @type {Map<String, CommandDef>} */
  #commands = new Map();

  /**
   * @param {string} name
   * @param {RunCommand} run
   * @param {CompleteCommand} [complete]
   */
  register(name, run, complete = DEFAULT_COMPLETE) {
    this.#commands.set(name, new CommandDef(name, run, complete));
  }

  /** @param {string} name */
  async load(name) {
    const module = await import(`./commands/${name}.js`);
    const { name: commandName, run, complete } = module;
    this.register(commandName, run, complete);
  }

  /**
   * @param {string} line
   * @param {REPLContext} context
   * @param {Goblin} agent
   * @param {AbortSignal} [signal]
   */
  async run(line, context, agent, signal) {
    const command = this.#commandFor(line);
    if (!command) throw new Error(`Unknown command: ${line}`);
    const args = line.slice(command.name.length);
    await command.run(args, context, agent, signal);
  }

  /**
   * @param {string} prefix
   * @param {REPLContext} context
   * @returns {Promise<string[]>}
   */
  async complete(prefix, context) {
    const command = this.#commandFor(prefix);
    if (!command) return [];
    try {
      const args = prefix.slice(command.name.length);
      return command.complete(args, context);
    } catch (e) {
      console.error("Error running completions", e.message);
      return [];
    }
  }

  /**
   * @returns {string[]}
   */
  names() {
    return [...this.#commands.keys()];
  }

  /**
   * @param {string} line
   * @returns {boolean}
   */
  has(line) {
    return this.#commandFor(line) !== null;
  }

  /**
   * @param {string} line
   * @returns {CommandDef|null}
   */
  #commandFor(line) {
    for (const [name, command] of this.#commands.entries()) {
      if (line.startsWith(name)) return command;
    }
    return null;
  }
}

export class CommandDef {
  #complete;
  #run;
  #name;

  /**
   * @param {string} name
   * @param {RunCommand} run
   * @param {CompleteCommand} complete
   */
  constructor(name, run, complete) {
    this.#name = name;
    this.#run = run;
    this.#complete = complete;
  }

  get name() {
    return this.#name;
  }

  /**
   * @param {string} prefix
   * @param {REPLContext} context
   */
  async complete(prefix, context) {
    const completions = await this.#complete(prefix, context);
    return completions.map((text) => this.name + text);
  }

  /**
   * @param {string} line
   * @param {REPLContext} context
   * @param {Goblin} agent
   * @param {AbortSignal} [signal]
   */
  async run(line, context, agent, signal) {
    await this.#run(line, context, agent, signal);
  }
}

export function DEFAULT_COMPLETE() {
  return [];
}
