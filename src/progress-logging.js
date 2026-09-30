import { diffLines } from "diff";
import { readFile } from "node:fs/promises";
import { check } from "./tools/shell_command.js";
import { color, INFO, QUIET, WARN } from "./ansi.js";
import { Logger } from "./logger.js";
import { isAbsolute, relative, resolve } from "node:path";

/**
 * Check whether a resolved path is within the given root directory.
 * @param {string} filePath
 * @param {string} root
 * @returns {boolean}
 */
export function isWithinRoot(filePath, root) {
  const resolved = resolve(filePath);
  const rel = relative(root, resolved);
  return !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Create progress-logging callbacks for Goblin.crank.
 * @param {object} [opts]
 * @param {((prompt: string) => Promise<void>)} [opts.confirm] - interactive confirmation (e.g. REPL); if omitted, dangerous ops are allowed with a log line.
 * @param {boolean} [opts.showThinking] - also log thinking tokens.
 * @param {boolean} [opts.allowLocal] - auto-approve writes/edits within cwd; still confirm for paths outside.
 * @param {Logger} [opts.logger] - logger instance; defaults to a new color Logger.
 */
export function makeProgressLogging({
  confirm,
  showThinking,
  allowLocal = false,
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
    /** @param {{url: string}} args */
    fetch: ({ url }) => logger.info(`Fetch: ${url}`),
    /** @param {{prompt: string}} args */
    sub_agent: ({ prompt }) =>
      logger.info(`Sub Agent: ${prompt.split(".")[0].trim()}...`),
    /** @param {{command: string}} args */
    async shell_command(args) {
      let command = args.command;
      if (check(command)) {
        // TODO: add verbal confirm for listen mode
        if (confirm) {
          await confirm(`${color(WARN, "! (dangerous)")}\n${command}`);
        } else {
          logger.warn(`! (dangerous) ${command}`);
        }
      } else {
        logger.info(`!${command}`);
      }
    },
    /** @param {{path: string, content: string}} args */
    async write_file(args) {
      if (allowLocal && isWithinRoot(args.path, process.cwd())) {
        logger.info(`Writing: ${args.path}`);
      } else if (confirm) {
        let existing = null;
        try {
          existing = await readFile(args.path, "utf8");
        } catch {
          /* file does not exist */
        }

        const diff =
          existing !== null ? renderDiff(existing, args.content) : undefined;

        await confirm(
          `Allow write to ${args.path}?\n${diff ?? `Content:\n${args.content}`}`,
        );
      } else {
        logger.info(`Writing: ${args.path}`);
      }
    },
    /** @param {{path: string, old_text: string, new_text: string}} args */
    async edit_file(args) {
      if (allowLocal && isWithinRoot(args.path, process.cwd())) {
        logger.info(`Editing: ${args.path}`);
      } else if (confirm) {
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
   * Render a line diff with color-coded prefixes. Unchanged runs longer than
   * 7 lines are condensed to the first and last three, with the middle
   * replaced by a muted elision marker.
   * @param {string} oldText
   * @param {string} newText
   */
  function renderDiff(oldText, newText) {
    const lines = [];
    for (const change of diffLines(oldText, newText)) {
      const parts = change.value.replace(/\n$/, "").split("\n");
      if (change.added || change.removed) {
        const code = change.added ? INFO : WARN;
        const prefix = change.added ? "+ " : "- ";
        for (const line of parts) lines.push(color(code, `${prefix}${line}`));
      } else if (parts.length > 7) {
        lines.push(...parts.slice(0, 3).map((l) => `  ${l}`));
        const hidden = parts.length - 6;
        lines.push(
          color(QUIET, `  … ${hidden} more line${hidden === 1 ? "" : "s"}`),
        );
        lines.push(...parts.slice(-3).map((l) => `  ${l}`));
      } else {
        lines.push(...parts.map((l) => `  ${l}`));
      }
    }
    return lines.join("\n");
  }
}
