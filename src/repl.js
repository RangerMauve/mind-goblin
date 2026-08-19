import readline from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import path from "node:path";
import fs from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const execAsync = promisify(exec);

import { program } from "commander";

import shellCommand from "./tools/shell_command.js";
import { USER, ASSISTANT, TOOL, Goblin } from "./index.js";
import { sessionFolder, conf } from "./utils.js";
import { makeCancelSignalResource } from "./cancel.js";
import { makeConfirm } from "./confirm.js";
import { Sessions } from "./sessions.js";
import { shouldConfirm, SHELL_JOINERS } from "./command_check.js";
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

  /**
   * @param {string} name
   * @param {object} args
   */
  async function onbeforetool(name, args) {
    if (name === "read") {
      // @ts-expect-error TODO cast args to expected shape
      console.log(`${INFO}Reading: %s${RESET}`, args.path);
    }
    if (name === "read_file") {
      // @ts-expect-error TODO cast args to expected shape
      console.log(`${INFO}Reading file: %s${RESET}`, args.path);
    }
    if (name === "read_directory") {
      // @ts-expect-error TODO cast args to expected shape
      console.log(`${INFO}Reading directory: %s${RESET}`, args.path);
    }
    if (name === "shell_command") {
      // @ts-expect-error TODO cast args to expected shape
      let command = args.command;
      const cdPrefix = `cd ${process.cwd()} && `;
      if (command.startsWith(cdPrefix)) {
        command = command.slice(cdPrefix.length);
      }
      // Allow some commands through without confirming
      if (shouldConfirm(command)) {
        await confirm(`${ALERT}Allow shell command?${RESET}\n${command}`);
      } else {
        console.log(`${INFO}!%s${RESET}`, command);
      }
    }
    if (name === "write_file") {
      // @ts-expect-error TODO cast args to expected shape
      await confirm(`Allow write to ${args.path}?\nContent:\n${args.content}`);
    }
    if (name === "edit_file") {
      await confirm(
        // @ts-expect-error TODO cast args to expected shape
        `Allow edit to ${args.path}?\nReplace:\n${args.old_text}\nWith:\n${args.new_text}`,
      );
    }
  }

  /**
   * @param {string} line
   * @returns {Promise<[string[], string]>}
   */
  async function completer(line) {
    const parts = line.split(" ");
    const lastPart = parts[parts.length - 1];
    // Only add the trailing space if there's more than one part
    // Else we should leave the first part blank
    const trailingSpace = parts.length > 1 ? " " : "";
    const firstPart = parts.slice(0, -1).join(" ") + trailingSpace;

    // Check for shell command prefix
    if (line.startsWith("!")) {
      const shellPart = line.slice(1);
      const commands = shellPart.split(SHELL_JOINERS);
      const lastCommand = commands[commands.length - 1];

      // Find the prefix including the last joiner
      const joinerMatches = [...shellPart.matchAll(SHELL_JOINERS)];
      const lastJoiner = joinerMatches[joinerMatches.length - 1];
      const prefix = lastJoiner
        ? "!" + shellPart.slice(0, lastJoiner.index + lastJoiner[0].length)
        : "!";

      try {
        const { stdout } = await execAsync(`compgen -acf "${lastCommand}"`);
        const completions = stdout.split("\n").filter(Boolean);
        return [completions.map((c) => prefix + c), line];
      } catch {
        // Ignore errors
      }
    }

    if (
      !lastPart.startsWith("../") &&
      !lastPart.startsWith("./") &&
      !lastPart.startsWith("/")
    ) {
      return [[], line];
    }

    try {
      const isFolder = lastPart.endsWith("/");
      const fullPath = path.join(process.cwd(), lastPart);

      const dir = isFolder ? fullPath : path.dirname(fullPath);
      const base = isFolder ? "" : path.basename(fullPath).toLowerCase();
      // Only add the last part's base name if it isn't a folder
      const prefix =
        firstPart + (isFolder ? lastPart : lastPart.slice(0, -base.length));

      // Get the fils and folders from the dir
      const files = await fs.readdir(dir, { withFileTypes: true });
      // Case insensitive match
      const matches = files.filter((f) =>
        f.name.toLowerCase().startsWith(base),
      );

      // Add the trailing slash if it's a folder to trigger further completions
      const completed = matches.map(
        (m) => prefix + m.name + (m.isDirectory() ? "/" : ""),
      );
      // console.log({lastPart, firstPart, dir, base, prefix, completed})
      return [completed, line];
    } catch (e) {
      console.error(e);
      return [[], line];
    }
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
