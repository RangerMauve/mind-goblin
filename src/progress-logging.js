import { diffLines } from "diff";
import { check } from "./tools/shell_command.js";
import { INFO, QUIET, ALERT, WARN, color } from "./ansi.js";

/**
 * Create progress-logging callbacks for Goblin.crank.
 * @param {object} [opts]
 * @param {((prompt: string) => Promise<void>)} [opts.confirm] - interactive confirmation (e.g. REPL); if omitted, dangerous ops are allowed with a log line.
 * @param {boolean} [opts.showThinking] - also log thinking tokens.
 * @param {(msg: string) => void} [opts.log] - output function; defaults to console.log.
 */
export function makeProgressLogging({
  confirm,
  showThinking,
  log = console.log,
} = {}) {
  /** @param {string} message */
  function onprogress(message) {
    log(color(QUIET, message));
  }

  /** @type {Record<string, (args: any) => void | Promise<void>>} */
  const beforeToolHandlers = {
    /** @param {{path: string}} args */
    read: (args) => {
      log(color(INFO, `Reading: ${args.path}`));
    },
    /** @param {{command: string}} args */
    async shell_command(args) {
      let command = args.command;
      const cdPrefix = `cd ${process.cwd()} && `;
      if (command.startsWith(cdPrefix)) {
        command = command.slice(cdPrefix.length);
      }
      if (check(command)) {
        // TODO: add verbal confirm for listen mode
        if (confirm) {
          await confirm(`${color(ALERT, "Allow shell command?")}\n${command}`);
        } else {
          log(color(ALERT, `! (dangerous) ${command}`));
        }
      } else {
        log(color(INFO, `!${command}`));
      }
    },
    /** @param {{path: string, content: string}} args */
    async write_file(args) {
      if (confirm) {
        await confirm(
          `Allow write to ${args.path}?\nContent:\n${args.content}`,
        );
      } else {
        log(color(INFO, `Writing: ${args.path}`));
      }
    },
    /** @param {{path: string, old_text: string, new_text: string}} args */
    async edit_file(args) {
      if (confirm) {
        await confirm(
          `Allow edit to ${args.path}?\n${renderDiff(args.old_text, args.new_text)}`,
        );
      } else {
        log(color(INFO, `Editing: ${args.path}`));
      }
    },
  };

  /**
   * @param {string} name
   * @param {object} args
   */
  async function onbeforetool(name, args) {
    const handler = beforeToolHandlers[name];
    if (handler) await handler(args);
    else log(color(INFO, `Using tool: ${name}`));
  }

  const onthinking = showThinking ? onprogress : undefined;

  return { onprogress, onbeforetool, onthinking };
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
