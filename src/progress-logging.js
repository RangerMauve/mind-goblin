import { diffLines } from "diff";
import { check } from "./tools/shell_command.js";
import { INFO, WARN, color } from "./ansi.js";
import { Logger } from "./logger.js";

/**
 * Create progress-logging callbacks for Goblin.crank.
 * @param {object} [opts]
 * @param {((prompt: string) => Promise<void>)} [opts.confirm] - interactive confirmation (e.g. REPL); if omitted, dangerous ops are allowed with a log line.
 * @param {boolean} [opts.showThinking] - also log thinking tokens.
 * @param {Logger} [opts.logger] - logger instance; defaults to a new color Logger.
 */
export function makeProgressLogging({
  confirm,
  showThinking,
  logger = new Logger(),
} = {}) {
  /** @param {string} message */
  async function onprogress(message) {
    logger.quiet(message);
  }

  /** @type {Record<string, (args: any) => void | Promise<void>>} */
  const beforeToolHandlers = {
    /** @param {{path: string}} args */
    read: (args) => logger.info(`Reading: ${args.path}`),
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
          await confirm(`${logger.warn("! (dangerous)")}\n${command}`);
        } else {
          logger.warn(`! (dangerous) ${command}`);
        }
      } else {
        logger.info(`!${command}`);
      }
    },
    /** @param {{path: string, content: string}} args */
    async write_file(args) {
      if (confirm) {
        await confirm(
          `Allow write to ${args.path}?\nContent:\n${args.content}`,
        );
      } else {
        logger.info(`Writing: ${args.path}`);
      }
    },
    /** @param {{path: string, old_text: string, new_text: string}} args */
    async edit_file(args) {
      if (confirm) {
        await confirm(
          `Allow edit to ${args.path}?\n${renderDiff(args.old_text, args.new_text)}`,
        );
      } else {
        logger.info(`Editing: ${args.path}`);
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
    else logger.info(`Using tool: ${name}`);
  }

  const onthinking = showThinking ? onprogress : undefined;

  return { onprogress, onbeforetool, onthinking };

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
        else lines.push(`  ${line}`);
      }
    }
    return lines.join("\n");
  }
}
