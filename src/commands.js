/** @import {REPLContext} from "./repl.js"*/

/** @typedef {(line: string, context: REPLContext)=> Promise<void> | void} RunCommand*/
/** @typedef {(prefix: string, context: REPLContext)=> Promise<string[]> | string[]} CompleteCommand*/

export class Commands {
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

  /**
   * @param {string} line
   * @param {REPLContext} context
   */
  async run(line, context) {
    const command = this.#commandFor(line);
    if (!command) return [];
    const args = line.slice(command.name.length);
    await command.run(args, context);
  }

  /**
   * @param {string} prefix
   * @param {REPLContext} context
   * @returns {Promise<string[]>}
   */
  async complete(prefix, context) {
    const command = this.#commandFor(prefix);
    if (!command) return [];
    const args = prefix.slice(command.name.length);
    return command.complete(args, context);
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
    return this.#complete(prefix, context);
  }

  /**
   * @param {string} line
   * @param {REPLContext} context
   */
  async run(line, context) {
    await this.#run(line, context);
  }
}

export function DEFAULT_COMPLETE() {
  return [];
}
