import readline from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { randomUUID } from "node:crypto";

import { program } from "commander";

import shellCommand from "./tools/shell_command.js";
import { USER, ASSISTANT, TOOL, Goblin } from "./index.js";
import { sessionFolder, conf } from "./utils.js";
import { makeCancelSignalResource } from "./cancel.js";
import { makeConfirm } from "./confirm.js";
import { Sessions } from "./sessions.js";
import { shouldConfirm } from "./command_check.js";
import { completer } from "./completer.js";
import { INFO, QUIET, ALERT, RESET, playBell } from "./ansi.js";

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
  const slug = sessions.slug(session);

  /**
   * @type {import('./index.js').Message[]}
   */
  const messages = session && !clear ? await sessions.load(slug) : [];
  const history = messages
    .filter(({ role }) => role === USER)
    .map(({ content }) => content);
  // Make most recent messages first
  history.reverse();

  const goblin = await Goblin.fromOptions({ ...program.opts(), ...goblinOpts });

  const rl = readline.createInterface({
    input,
    output,
    history,
    completer,
  });
  emitKeypressEvents(input);

  rl.once("close", () => process.exit(0));

  /**
   * @param {string} message
   */
  function onprogress(message) {
    console.log(`${QUIET}%s${RESET}`, message);
  }

  const confirm = makeConfirm(rl, input);

  /** @type {Record<string, any>} */
  const beforeToolHandlers = {
    /** @param {{path: string}} args */
    read: (args) => {
      console.log(`${INFO}Reading: %s${RESET}`, args.path);
    },
    /** @param {{command: string}} args */
    async shell_command(args) {
      let command = args.command;
      const cdPrefix = `cd ${process.cwd()} && `;
      if (command.startsWith(cdPrefix)) {
        command = command.slice(cdPrefix.length);
      }
      if (shouldConfirm(command)) {
        await confirm(`${ALERT}Allow shell command?${RESET}\n${command}`);
      } else {
        console.log(`${INFO}!%s${RESET}`, command);
      }
    },
    /** @param {{path: string, content: string}} args */
    async write_file(args) {
      await confirm(`Allow write to ${args.path}?\nContent:\n${args.content}`);
    },
    /** @param {{path: string, old_text: string, new_text: string}} args */
    async edit_file(args) {
      await confirm(
        `Allow edit to ${args.path}?\nReplace:\n${args.old_text}\nWith:\n${args.new_text}`,
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
    else console.log(`${INFO}Using tool: %s${RESET}`, name);
  }

  const onthinking = showThinking ? onprogress : undefined;

  while (true) {
    try {
      const content = await rl.question("> ");
      // Run shell commands directly, recording them as a tool call in the history
      if (content.startsWith("!")) {
        const command = content.slice(1);
        console.log(`${QUIET}$ ${command}${RESET}`);
        let output;
        try {
          const { stdout, stderr } = await shellCommand({ command });
          if (stdout)
            process.stdout.write(
              stdout.endsWith("\n") ? stdout : stdout + "\n",
            );
          if (stderr) process.stderr.write(stderr);
          output = stdout + stderr;
        } catch (e) {
          const stdout = e.stdout ?? "";
          const stderr = e.stderr ?? e.message;
          if (stdout) process.stdout.write(stdout);
          if (stderr)
            process.stderr.write(
              stderr.endsWith("\n") ? stderr : stderr + "\n",
            );
          output = stdout + stderr;
        }
        const toolCallId = `call_${randomUUID()}`;
        messages.push(
          { role: USER, content },
          {
            role: ASSISTANT,
            content: "",
            tool_calls: [
              {
                id: toolCallId,
                type: "function",
                function: {
                  name: "shell_command",
                  arguments: JSON.stringify({ command }),
                },
              },
            ],
          },
          {
            role: TOOL,
            content: output || "(no output)",
            name: "shell_command",
            tool_call_id: toolCallId,
          },
        );
        playBell();
        await sessions.save(slug, messages);
        continue;
      }
      messages.push({ role: USER, content });
      await goblin.crank(messages, {
        onprogress,
        onbeforetool,
        onthinking,
        listenForCancel: () => makeCancelSignalResource(input),
      });
      const response = messages.at(-1);
      // TODO: render formatted as markdown
      console.log(response?.content);
      playBell();
    } catch (e) {
      if (e.name === "AbortError") continue;
      throw e;
    }
    await sessions.save(slug, messages);
  }
}
