import path from "node:path";
import fs from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { SHELL_JOINERS } from "./command_check.js";

const execAsync = promisify(exec);

/**
 * @param {string} line
 * @returns {Promise<[string[], string]>}
 */
export async function completer(line) {
  const parts = line.split(" ");
  const lastPart = parts[parts.length - 1];
  const trailingSpace = parts.length > 1 ? " " : "";
  const firstPart = parts.slice(0, -1).join(" ") + trailingSpace;

  // Shell command completion
  if (line.startsWith("!")) {
    const shellPart = line.slice(1);
    const commands = shellPart.split(SHELL_JOINERS);
    const lastCommand = commands[commands.length - 1];

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
    const matches = files.filter((f) => f.name.toLowerCase().startsWith(base));

    const completed = matches.map(
      (m) => prefix + m.name + (m.isDirectory() ? "/" : ""),
    );
    return [completed, line];
  } catch {
    return [[], line];
  }
}
