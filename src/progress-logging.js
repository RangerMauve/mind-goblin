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
 * @param {boolean} [opts.allowAll] - skip all confirmations, allowing any tool and any path.
 * @param {Logger} [opts.logger] - logger instance; defaults to a new color Logger.
 */
export function makeProgressLogging({
  confirm,
  showThinking,
  allowLocal = false,
  allowAll = false,
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
    search_web: ({ query }) => logger.info(`Searching "${query}"`),
    /** @param {{prompt: string}} args */
    sub_agent: ({ prompt }) =>
      logger.info(`Sub Agent: ${prompt.split(".")[0].trim()}...`),
    /** @param {{role?: string, matches?: string, dryRun?: boolean}} args */
    prune(args) {
      const parts = [];
      if (args.dryRun) parts.push("(dry run)");
      if (args.role) parts.push(`role=${args.role}`);
      if (args.matches) parts.push(`/${args.matches}/`);
      logger.info(
        parts.length ? `Pruning: ${parts.join(" ")}` : "Pruning previous turn",
      );
    },
    /** @param {{n?: number}} args */
    compact({ n }) {
      logger.info(
        n ? `Compacting: ${n} oldest messages` : "Compacting: full history",
      );
    },
    /** @param {{name: string}} args */
    skill: ({ name }) => logger.info(`Loading skill: ${name}`),
    /** @param {{name: string}} args */
    unskill: ({ name }) => logger.info(`Unloading skill: ${name}`),
    /** @param {{command: string, summary: string}} args */
    async shell_command(args) {
      const { command, summary } = args;
      if (check(command)) {
        if (allowAll) {
          logger.info(`! (dangerous, auto-approved) ${summary} - ${command}`);
        } else if (confirm) {
          // TODO: add verbal confirm for listen mode
          await confirm(
            `${color(WARN, "! (dangerous)")} ${summary}\n${command}`,
          );
        } else {
          logger.warn(`! (dangerous) ${summary} - ${command}`);
        }
      } else {
        logger.info(`Shell: ${summary}`);
      }
    },
    /** @param {{path: string, content: string, summary: string}} args */
    async write_file(args) {
      if (allowAll || (allowLocal && isWithinRoot(args.path, process.cwd()))) {
        logger.info(`Writing: ${args.path} — ${args.summary}`);
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
          `Allow write to ${args.path} — ${args.summary}?\n${diff ?? `Content:\n${args.content}`}`,
        );
      } else {
        logger.info(`Writing: ${args.path} — ${args.summary}`);
      }
    },
    /** @param {{path: string, old_text: string, new_text: string, summary: string, regex?: boolean, all?: boolean, caseInsensitive?: boolean}} args */
    async edit_file(args) {
      if (allowAll || (allowLocal && isWithinRoot(args.path, process.cwd()))) {
        logger.info(`Editing: ${args.path} — ${args.summary}`);
      } else if (confirm) {
        const detail = args.regex
          ? renderRegex(args.old_text, args.new_text, args)
          : renderDiff(args.old_text, args.new_text);
        await confirm(
          `Allow edit to ${args.path} — ${args.summary}?\n${detail}`,
        );
      } else {
        logger.info(`Editing: ${args.path} — ${args.summary}`);
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

  /**
   * Render a regex edit as a plain "pattern → replacement" line for the
   * confirm prompt, with any flags shown in muted parentheses. The pattern
   * and replacement are highlighted so the raw text stands out.
   * @param {string} pattern The regex pattern (old_text)
   * @param {string} replacement The replacement (new_text)
   * @param {{all?: boolean, caseInsensitive?: boolean}} opts
   * @returns {string}
   */
  function renderRegex(pattern, replacement, opts) {
    const flags = [
      opts.all && "all",
      opts.caseInsensitive && "case-insensitive",
    ]
      .filter(Boolean)
      .join(", ");
    const tail = flags ? `  ${color(QUIET, `(${flags})`)}` : "";
    return `${color(INFO, pattern)}  ${color(QUIET, "→")}  ${color(
      INFO,
      replacement,
    )}${tail}`;
  }
}
