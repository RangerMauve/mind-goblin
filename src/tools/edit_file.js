import fs from "node:fs/promises";

export const name = "edit_file";
export const readonly = false;
export const description =
  "Replaces text in a file at the specified path. Supports exact string or regex matching, with optional global and case-insensitive matching. Regex patterns always match line boundaries (^ and $).";

export const parameters = {
  type: "object",
  required: ["path", "old_text", "new_text"],
  properties: {
    path: {
      type: "string",
      description: "The absolute or relative path to the file",
    },
    old_text: {
      type: "string",
      description:
        "The text to replace. Treated as an exact string unless regex is true, in which case it is a regular expression pattern.",
    },
    new_text: {
      type: "string",
      description:
        "The new text to insert. When regex is true, supports $1 / ${name} capture group references.",
    },
    all: {
      type: "boolean",
      description:
        "Replace all occurrences instead of only the first. Defaults to false.",
      default: false,
    },
    regex: {
      type: "boolean",
      description:
        "Treat old_text as a regular expression. Defaults to false (exact string match).",
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
 * Escape a string so it can be used as a literal pattern in a RegExp.
 * @param {string} s The string to escape
 * @returns {string} The escaped string
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces text in a file at the specified path.
 * @param {object} parameters
 * @param {string} parameters.path The absolute or relative path to the file
 * @param {string} parameters.old_text The text (or regex pattern) to replace
 * @param {string} parameters.new_text The new text to insert
 * @param {boolean} [parameters.all] Replace all occurrences (default false)
 * @param {boolean} [parameters.regex] Treat old_text as a regex (default false)
 * @param {boolean} [parameters.caseInsensitive] Case-insensitive matching (default false)
 * @returns {Promise<{success: true, path: string, replacements: number}|{error: string}>}
 */
export default async function editFile({
  path,
  old_text,
  new_text,
  all = false,
  regex = false,
  caseInsensitive = false,
}) {
  try {
    if (!old_text) {
      return { error: "old_text must not be empty." };
    }

    // Read the file
    const contents = await fs.readFile(path, "utf8");

    const pattern = regex ? old_text : escapeRegExp(old_text);
    // Regex patterns always match line boundaries; case-insensitivity is opt-in.
    const extraFlags = `${regex ? "m" : ""}${caseInsensitive ? "i" : ""}`;

    // Count total matches (always global for counting)
    const matches = contents.match(new RegExp(pattern, `g${extraFlags}`));
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
      newContents = contents.replace(
        new RegExp(pattern, `g${extraFlags}`),
        new_text,
      );
      replacements = total;
    } else {
      // Replace only the first occurrence
      newContents = contents.replace(new RegExp(pattern, extraFlags), new_text);
      replacements = 1;
    }

    await fs.writeFile(path, newContents, "utf8");
    return { success: true, path, replacements };
  } catch (e) {
    return { error: e.message };
  }
}
