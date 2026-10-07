import readline from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { stdin as input, stdout as output } from "node:process";

import { Goblin, USER } from "./index.js";
import { sessionFolder } from "./utils.js";
import { makeCancelSignalResource } from "./cancel.js";
import { makeConfirm } from "./confirm.js";
import { Sessions } from "./sessions.js";
import { makeCompleter } from "./completer.js";
import { Commands } from "./commands.js";
import { makeProgressLogging } from "./progress-logging.js";
import { playBell } from "./ansi.js";
import { Logger } from "./logger.js";
import { Context } from "./context.js";

/** @import { Message } from "./index.js" */
/** @import { Session } from "./sessions.js" */
/** @import { CancelResource } from "./cancel.js" */
/** @import { Config } from "./utils.js" */

/**
 * @typedef {Config & {
 *   config: Config,
 *   debug?: boolean,
 *   showThinking?: boolean,
 *   session?: string,
 *   clear?: boolean,
 *   thinkingHistory?: boolean,
 * }} ReplOptions
 */

export class REPLContext extends Context {
  /** @type {Logger} */
  #logger;

  /** @type {ReturnType<typeof makeProgressLogging> & {listenForCancel?: () => CancelResource?}} */
  #crankOptions;

  /** @type {{fn: ((prompt: string) => Promise<void>) | null}} */
  #confirmRef = { fn: null };

  /**
   * @param {Goblin} goblin
   * @param {import("./sessions.js").Session} session
   * @param {object} [options]
   * @param {Logger} [options.logger]
   * @param {boolean} [options.showThinking]
   * @param {boolean} [options.allowLocal]
   * @param {(() => CancelResource?)} [options.listenForCancel]
   */
  constructor(goblin, session, options = {}) {
    super(goblin, session);
    const {
      logger = new Logger(),
      showThinking,
      allowLocal = false,
      listenForCancel,
    } = options;
    this.#logger = logger;
    this.#crankOptions = {
      ...makeProgressLogging({
        confirm: (prompt) => {
          if (!this.#confirmRef.fn) throw new Error("confirm not yet set");
          return this.#confirmRef.fn(prompt);
        },
        showThinking,
        allowLocal,
        logger,
      }),
      ...(listenForCancel && { listenForCancel }),
    };
  }

  get logger() {
    return this.#logger;
  }

  get history() {
    const items = this.messages.filter(({ role }) => role === USER);
    const history = [];
    for (const { content } of items) {
      if (typeof content === "string") history.push(content);
    }
    // Make most recent messages first
    history.reverse();

    return history;
  }

  /**
   * Set the interactive confirmation function. Must be called before crank.
   * @param {(prompt: string) => Promise<void>} confirm
   */
  setConfirm(confirm) {
    this.#confirmRef.fn = confirm;
  }

  /**
   * Run a full agentic turn: crank the goblin, log the response, play bell.
   * @param {AbortSignal} [signal] Fallback cancellation signal
   */
  async crank(signal) {
    const response = await super.crank(signal, this.#crankOptions);
    this.#logger.assistant(/** @type {string} */ (response?.content));
    playBell();
    return response;
  }
}

/**
 * @param {ReplOptions} options
 */
export async function repl(options) {
  const { showThinking, session, clear, allowLocal, config, ...goblinOpts } =
    options;
  const sessions = new Sessions(sessionFolder);
  const commands = await Commands.default();

  const goblin = await Goblin.fromOptions({ ...goblinOpts, config });

  const context = new REPLContext(goblin, sessions.make(session), {
    showThinking,
    allowLocal,
    listenForCancel: () => makeCancelSignalResource(input),
  });
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

  context.setConfirm(makeConfirm(rl, input));

  while (true) {
    try {
      const content = await rl.question("> ");
      // Run shell commands directly, recording them as a tool call in the history
      if (commands.has(content)) {
        using cancel = makeCancelSignalResource(input);
        await commands.run(content, context, cancel.signal);
      } else {
        context.messages.push({ role: USER, content });
        await context.crank();
      }
    } catch (e) {
      console.error(e.stack);
    }
    await context.save();
  }
}
