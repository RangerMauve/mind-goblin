import { randomUUID } from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import { SHELL_JOINERS } from "../shell_check.js";
import shellCommand from "../tools/shell_command.js";
import { USER, ASSISTANT, TOOL } from "../index.js";
import { QUIET, WARN, color, playBell } from "../ansi.js";

/** @import {Message} from "../index.js"*/
/** @import {REPLContext} from "../repl.js"*/

export const name = "!";

const execAsync = promisify(exec);

/**
 * @param {string} line
 * @returns {Promise<string[]>}
 */
export async function complete(line) {
  // Shell command completion
  const commands = line.split(SHELL_JOINERS);
  const lastCommand = commands[commands.length - 1];

  const joinerMatches = [...line.matchAll(SHELL_JOINERS)];
  const lastJoiner = joinerMatches[joinerMatches.length - 1];
  const prefix = lastJoiner
    ? line.slice(0, lastJoiner.index + lastJoiner[0].length)
    : "";

  try {
    const { stdout } = await execAsync(`compgen -acf "${lastCommand}"`);
    const completions = stdout.split("\n").filter(Boolean);
    return completions.map((c) => prefix + c);
  } catch {
    // Ignore errors
    return [];
  }
}
/**
 * @param {string} command
 * @param {REPLContext} context
 */
export async function run(command, context) {
  let output;
  try {
    const { stdout, stderr } = await shellCommand({ command });
    output = stdout + stderr;
    console.log(stdout);
    if (stderr) console.log(color(WARN, stderr));
  } catch (e) {
    console.error(e.message);
    return;
  }
  const toolCallId = `call_${randomUUID()}`;
  context.push(
    { role: USER, content: name + command },
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
}
