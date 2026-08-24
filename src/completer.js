import path from "node:path";
import fs from "node:fs/promises";


/** @import { Commands } from "./commands.js" */
/** @import { REPLContext } from "./repl.js" */

/**
 * @param {Commands} commands
 * @param {REPLContext} context
 */
export function makeCompleter(commands, context) {
  /**
   * @param {string} line
   * @returns {Promise<[string[], string]>}
   */
  return async function completer(line) {
    const parts = line.split(" ");
    const lastPart = parts[parts.length - 1];
    const trailingSpace = parts.length > 1 ? " " : "";
    const firstPart = parts.slice(0, -1).join(" ") + trailingSpace;

    if (commands.has(line)) {
      const complete = await commands.complete(line, context);
      if (complete.length) return [complete, line];
    }

    // File path completion
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
      const prefix =
        firstPart + (isFolder ? lastPart : lastPart.slice(0, -base.length));

      const files = await fs.readdir(dir, { withFileTypes: true });
      const matches = files.filter((f) =>
        f.name.toLowerCase().startsWith(base),
      );

      const completed = matches.map(
        (m) => prefix + m.name + (m.isDirectory() ? "/" : ""),
      );
      return [completed, line];
    } catch {
      return [[], line];
    }
  };
}
