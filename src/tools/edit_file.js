import fs from "node:fs/promises";

export const name = "edit_file";
export const readonly = false;
export const description =
  "Replaces text in a file at the specified path. Exact string matching with optional global and case-insensitive matching.";

export const parameters = {
  type: "object",
  required: ["path", "old_text", "new_text", "summary"],
  properties: {
    summary: {
      type: "string",
      description:
        "A very short summary of what this edit does, e.g. 'remove unused import'.",
    },
    path: {
      type: "string",
      description: "The absolute or relative path to the file",
    },
    old_text: {
      type: "string",
      description: "The exact text to find in the file.",
    },
    new_text: {
      type: "string",
      description: "The new text to insert.",
    },
    all: {
      type: "boolean",
      description:
        "Replace all occurrences instead of only the first. Defaults to false.",
      default: false,
    },
    caseInsensitive: {
      type: "boolean",
      description: "Case-insensitive matching. Defaults to false.",
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
 * Replaces exact text in a file at the specified path.
 * @param {object} parameters
 * @param {string} parameters.path The absolute or relative path to the file
 * @param {string} parameters.old_text The exact text to find
 * @param {string} parameters.new_text The new text to insert
 * @param {boolean} [parameters.all] Replace all occurrences (default false)
 * @param {boolean} [parameters.caseInsensitive] Case-insensitive matching (default false)
 * @returns {Promise<{success: true, path: string, replacements: number}|{error: string}>}
 */
export default async function editFile({
  path,
  old_text,
  new_text,
  all = false,
  caseInsensitive = false,
}) {
  try {
    if (!old_text) {
      return { error: "old_text must not be empty." };
    }

    const contents = await fs.readFile(path, "utf8");

    const pattern = escapeRegExp(old_text);
    const flags = caseInsensitive ? "i" : "";

    const matches = contents.match(new RegExp(pattern, `g${flags}`));
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
        new RegExp(pattern, `g${flags}`),
        new_text,
      );
      replacements = total;
    } else {
      newContents = contents.replace(new RegExp(pattern, flags), new_text);
      replacements = 1;
    }

    await fs.writeFile(path, newContents, "utf8");
    return { success: true, path, replacements };
  } catch (e) {
    return { error: e.message };
  }
}
