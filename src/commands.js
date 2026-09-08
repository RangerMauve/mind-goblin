/** @import {REPLContext} from "./repl.js"*/

/** @typedef {(line: string, context: REPLContext, commands: Commands, signal?: AbortSignal)=> Promise<void> | void} RunCommand*/
/** @typedef {(prefix: string, context: REPLContext, commands: Commands)=> Promise<string[]> | string[]} CompleteCommand*/

export class Commands {
  static async default() {
    const commands = new Commands();
    await commands.load("shell");
    await commands.load("compact");
    await commands.load("clear");
    await commands.load("length");
    await commands.load("tail");
    await commands.load("retry");
    await commands.load("help");
    return commands;
  }

  /** @type {Map<String, CommandDef>} */
  #commands = new Map();

  /**
   * @param {string} name
   * @param {RunCommand} run
   * @param {CompleteCommand} [complete]
   * @param {string} [description]
   */
  register(name, run, complete = DEFAULT_COMPLETE, description = "") {
    this.#commands.set(name, new CommandDef(name, run, complete, description));
  }

  /** @param {string} name */
  async load(name) {
    const module = await import(`./commands/${name}.js`);
    const { name: commandName, default: run, complete, description } = module;
    this.register(commandName, run, complete, description);
  }

  /**
   * @param {string} line
   * @param {REPLContext} context
   * @param {AbortSignal} [signal]
   */
  async run(line, context, signal) {
    const command = this.#commandFor(line);
    if (!command) throw new Error(`Unknown command: ${line}`);
    const args = line.slice(command.name.length);
    await command.run(args, context, this, signal);
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
      let args = prefix.slice(command.name.length);
      const sep = command.name.length > 1 ? " " : "";
      if (sep && args.startsWith(sep)) args = args.slice(sep.length);
      const completions = await command.complete(args, context, this);
      return completions.map((text) => command.name + sep + text);
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
   * @returns {Map<string, string>}
   */
  descriptions() {
    /** @type {Map<string, string>} */
    const map = new Map();
    for (const [name, cmd] of this.#commands.entries()) {
      map.set(name, cmd.description);
    }
    return map;
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
  #description;

  /**
   * @param {string} name
   * @param {RunCommand} run
   * @param {CompleteCommand} complete
   * @param {string} description
   */
  constructor(name, run, complete, description = "") {
    this.#name = name;
    this.#run = run;
    this.#complete = complete;
    this.#description = description;
  }

  get name() {
    return this.#name;
  }

  get description() {
    return this.#description;
  }

  /**
   * @param {string} prefix
   * @param {REPLContext} context
   * @param {Commands} commands
   */
  async complete(prefix, context, commands) {
    return this.#complete(prefix, context, commands);
  }

  /**
   * @param {string} line
   * @param {REPLContext} context
   * @param {Commands} commands
   * @param {AbortSignal} [signal]
   */
  async run(line, context, commands, signal) {
    await this.#run(line, context, commands, signal);
  }
}

export function DEFAULT_COMPLETE() {
  return [];
}
