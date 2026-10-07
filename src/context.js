/** @import { Goblin, Message } from "./index.js" */
/** @import { Session } from "./sessions.js" */
/** @import { CancelResource } from "./cancel.js" */

/**
 * General-purpose session context shared across tools, commands, REPL, and speech.
 * Holds the agent, conversation messages, and persistence session.
 */
export class Context {
  /** @type {Goblin} */
  #goblin;
  /** @type {Session | null} */
  #session;
  /** @type {Message[]} */
  #messages = [];

  /**
   * @param {Goblin} goblin
   * @param {Session | null} [session]
   */
  constructor(goblin, session = null) {
    this.#goblin = goblin;
    this.#session = session;
  }

  get goblin() {
    return this.#goblin;
  }

  get session() {
    return this.#session;
  }

  get messages() {
    return this.#messages;
  }

  /** @returns {string | null} */
  get sessionName() {
    return this.#session?.name ?? null;
  }

  /**
   * List sibling session names.
   * @returns {Promise<string[]>}
   */
  async sessions() {
    if (!this.#session) return [];
    return this.#session.siblings();
  }

  /**
   * Fork to a new session.
   * @param {string} name
   * @returns {Promise<string>}
   */
  async forkSession(name) {
    await this.save();
    if (!this.#session) throw new Error("No session to fork from.");
    this.#session = this.#session.fork(name);
    await this.save();
    return name;
  }

  /**
   * Run a full agentic turn.
   * @param {AbortSignal} [signal]
   * @param {object} [options]
   * @param {(message: string) => void|Promise<void>} [options.onprogress]
   * @param {(name:string, args: object) => void|Promise<void>} [options.onbeforetool]
   * @param {(message: string) => void|Promise<void>} [options.onthinking]
   * @param {(() => CancelResource?)} [options.listenForCancel]
   * @returns {Promise<Message>} The final assistant message
   */
  async crank(signal, options = {}) {
    await this.#goblin.crank(this.#messages, {
      ...options,
      context: this,
      signal,
    });
    // @ts-expect-error messages will have at least one item after crank
    return this.#messages.at(-1);
  }

  async save() {
    if (this.#session) await this.#session.save(this.#messages);
  }

  async load() {
    if (this.#session) this.#messages = await this.#session.load();
  }

  /** @param {...Message} messages */
  push(...messages) {
    this.#messages.push(...messages);
  }
}
