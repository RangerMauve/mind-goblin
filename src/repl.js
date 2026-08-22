import readline from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { stdin as input, stdout as output } from "node:process";

import { program } from "commander";
import { diffLines } from "diff";

import { USER, Goblin } from "./index.js";
import { sessionFolder, conf } from "./utils.js";
import { makeCancelSignalResource } from "./cancel.js";
import { makeConfirm } from "./confirm.js";
import { Sessions } from "./sessions.js";
import { shouldConfirm } from "./shell_check.js";
import { makeCompleter } from "./completer.js";
import { Commands } from "./commands.js";
import { INFO, QUIET, ALERT, WARN, color, playBell } from "./ansi.js";

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

  /**
   * @param {string} message
   */
  function onprogress(message) {
    console.log(color(QUIET, message));
  }

  const confirm = makeConfirm(rl, input);

  /** @type {Record<string, any>} */
  const beforeToolHandlers = {
    /** @param {{path: string}} args */
    read: (args) => {
      console.log(color(INFO, `Reading: ${args.path}`));
    },
    /** @param {{command: string}} args */
    async shell_command(args) {
      let command = args.command;
      const cdPrefix = `cd ${process.cwd()} && `;
      if (command.startsWith(cdPrefix)) {
        command = command.slice(cdPrefix.length);
      }
      if (shouldConfirm(command)) {
        await confirm(`${color(ALERT, "Allow shell command?")}\n${command}`);
      } else {
        console.log(color(INFO, `!${command}`));
      }
    },
    /** @param {{path: string, content: string}} args */
    async write_file(args) {
      await confirm(`Allow write to ${args.path}?\nContent:\n${args.content}`);
    },
    /** @param {{path: string, old_text: string, new_text: string}} args */
    async edit_file(args) {
      await confirm(
        `Allow edit to ${args.path}?\n${renderDiff(args.old_text, args.new_text)}`,
      );
    },
  };

  /**
   * @param {string} name
   * @param {object} args
   */
  async function onbeforetool(name, args) {
    const handler = beforeToolHandlers[name];
    if (handler) await handler(args);
    else console.log(color(INFO, `Using tool: ${name}`));
  }

  const onthinking = showThinking ? onprogress : undefined;

  while (true) {
    try {
      const content = await rl.question("> ");
      // Run shell commands directly, recording them as a tool call in the history
      if (commands.has(content)) {
        await commands.run(content, context);
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

/**
 * Render a line diff with color-coded prefixes.
 * @param {string} oldText
 * @param {string} newText
 */
function renderDiff(oldText, newText) {
  const changes = diffLines(oldText, newText);
  const lines = [];
  for (const change of changes) {
    const parts = change.value.replace(/\n$/, "").split("\n");
    for (const line of parts) {
      if (change.removed) lines.push(color(WARN, `- ${line}`));
      else if (change.added) lines.push(color(INFO, `+ ${line}`));
      else lines.push(color(QUIET, `  ${line}`));
    }
  }
  return lines.join("\n");
}
