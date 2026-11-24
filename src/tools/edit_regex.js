import fs from "node:fs/promises";

export const name = "edit_regex";
export const readonly = false;
export const description =
  "Replaces text in a file using a regular expression pattern. Patterns always match line boundaries (^ and $). Supports capture group references ($1, ${name}) in the replacement.";

export const parameters = {
  type: "object",
  required: ["path", "pattern", "replacement", "summary"],
  properties: {
    summary: {
      type: "string",
      description:
        "A very short summary of what this edit does, e.g. 'convert tabs to spaces'.",
    },
    path: {
      type: "string",
      description: "The absolute or relative path to the file",
    },
    pattern: {
      type: "string",
      description: "The regular expression pattern to search for.",
    },
    replacement: {
      type: "string",
      description:
        "The replacement text. Supports $1 / ${name} capture group references.",
    },
    all: {
      type: "boolean",
      description:
        "Replace all occurrences instead of only the first. Defaults to false.",
      default: false,
    },
    caseInsensitive: {
      type: "boolean",
      description:
        "Case-insensitive matching (regex 'i' flag). Defaults to false.",
      default: false,
    },
  },
};

/**
 * Replaces text in a file at the specified path using a regex pattern.
 * @param {object} parameters
 * @param {string} parameters.path The absolute or relative path to the file
 * @param {string} parameters.pattern The regex pattern to search for
 * @param {string} parameters.replacement The replacement text
 * @param {boolean} [parameters.all] Replace all occurrences (default false)
 * @param {boolean} [parameters.caseInsensitive] Case-insensitive matching (default false)
 * @returns {Promise<{success: true, path: string, replacements: number}|{error: string}>}
 */
export default async function editRegex({
  path,
  pattern,
  replacement,
  all = false,
  caseInsensitive = false,
}) {
  try {
    if (!pattern) {
      return { error: "pattern must not be empty." };
    }

    let re;
    try {
      re = new RegExp(pattern, `m${caseInsensitive ? "i" : ""}`);
    } catch (e) {
      return { error: `Invalid regex pattern: ${e.message}` };
    }

    const contents = await fs.readFile(path, "utf8");

    const gRe = new RegExp(pattern, `gm${caseInsensitive ? "i" : ""}`);
    const matches = contents.match(gRe);
    const total = matches ? matches.length : 0;
    if (total === 0) {
      return {
        error:
          "Pattern not found in file. Use read to check the contents and try again.",
      };
    }

    let newContents;
    let replacements;
    if (all) {
      newContents = contents.replace(gRe, replacement);
      replacements = total;
    } else {
      newContents = contents.replace(re, replacement);
      replacements = 1;
    }

    await fs.writeFile(path, newContents, "utf8");
    return { success: true, path, replacements };
  } catch (e) {
    return { error: e.message };
  }
}
