import path from "node:path";
import os from "node:os";
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

    // Command name completion
    if (line.startsWith("/")) {
      const matches = commands.names().filter((n) => n.startsWith(line));
      if (matches.length) return [matches, line];
    }

    // File path completion
    if (
      !lastPart.startsWith("../") &&
      !lastPart.startsWith("./") &&
      !lastPart.startsWith("/") &&
      !lastPart.startsWith("~")
    ) {
      return [[], line];
    }

    try {
      const isFolder = lastPart.endsWith("/") || lastPart === "~";
      const lastSlash = lastPart.lastIndexOf("/");
      const base = isFolder
        ? ""
        : (lastSlash >= 0 ? lastPart.slice(lastSlash + 1) : lastPart).toLowerCase();

      // Resolve the directory to list
      let dir;
      if (lastPart.startsWith("~")) {
        const home = os.homedir();
        const sub = isFolder
          ? lastPart.slice(1)
          : lastPart.slice(1, lastSlash + 1);
        dir = home + sub;
      } else {
        const dirPart = isFolder ? lastPart : (lastSlash >= 0 ? lastPart.slice(0, lastSlash + 1) : ".");
        dir = path.resolve(dirPart);
      }

      const prefix =
        firstPart +
        (isFolder
          ? lastPart + (lastPart === "~" ? "/" : "")
          : lastPart.slice(0, -base.length));

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
