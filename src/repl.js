import readline from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { stdin as input, stdout as output } from "node:process";

import { program } from "commander";

import { USER, Goblin } from "./index.js";
import { sessionFolder, conf } from "./utils.js";
import { makeCancelSignalResource } from "./cancel.js";
import { makeConfirm } from "./confirm.js";
import { Sessions } from "./sessions.js";
import { makeCompleter } from "./completer.js";
import { Commands } from "./commands.js";
import { makeProgressLogging } from "./progress-logging.js";
import { playBell } from "./ansi.js";

/** @import { Message } from "./index.js" */
/** @import { Session } from "./sessions.js" */

export class REPLContext {
  #goblin;
  #session;

  /**
   * @type {Message[]}
   */
  #messages = [];

  /**
   * @param {Goblin} goblin
   * @param {Session} session
   */
  constructor(goblin, session) {
    this.#goblin = goblin;
    this.#session = session;
  }

  get goblin() {
    return this.#goblin;
  }

  get messages() {
    return this.#messages;
  }

  get history() {
    const history = this.#messages
      .filter(({ role }) => role === USER)
      .map(({ content }) => content);
    // Make most recent messages first
    history.reverse();

    return history;
  }
  async save() {
    await this.#session.save(this.#messages);
  }

  async load() {
    this.#messages = await this.#session.load();
  }

  /** @param {Message[]} messages */
  push(...messages) {
    this.#messages.push(...messages);
  }
}

/**
 * @param {object} options
 * @param {boolean} [options.showThinking]
 * @param {string} [options.session] Name of the session to resume/save
 * @param {boolean} [options.clear] Clear session before starting
 */
export async function repl(options) {
  const { showThinking, session, clear, ...goblinOpts } = {
    ...conf,
    ...options,
  };
  const sessions = new Sessions(sessionFolder);
  const commands = await Commands.default();

  const goblin = await Goblin.fromOptions({ ...program.opts(), ...goblinOpts });

  const context = new REPLContext(goblin, sessions.make(session));
  if (session && !clear) {
    await context.load();
  }

  const completer = makeCompleter(commands, context);

  const rl = readline.createInterface({
    input,
    output,
    history: context.history,
    completer,
  });
  emitKeypressEvents(input);

  rl.once("close", () => process.exit(0));

  const confirm = makeConfirm(rl, input);
  const { onprogress, onbeforetool, onthinking } = makeProgressLogging({
    confirm,
    showThinking,
  });

  while (true) {
    try {
      const content = await rl.question("> ");
      // Run shell commands directly, recording them as a tool call in the history
      if (commands.has(content)) {
        using cancel = makeCancelSignalResource(input);
        await commands.run(content, context, cancel.signal);
      } else {
        context.messages.push({ role: USER, content });
        await goblin.crank(context.messages, {
          onprogress,
          onbeforetool,
          onthinking,
          listenForCancel: () => makeCancelSignalResource(input),
        });
        const response = context.messages.at(-1);
        // TODO: render formatted as markdown
        console.log(response?.content);
        playBell();
      }
    } catch (e) {
      if (e.name === "AbortError") continue;
      throw e;
    }
    await context.save();
  }
}
