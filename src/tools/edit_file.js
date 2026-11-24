import fs from "node:fs/promises";

export const name = "edit_file";
export const readonly = false;
export const description =
  "Replaces the first occurrence of an exact string in a file. For global or regex replacements, use edit_regex instead.";

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
 * Replaces the first occurrence of an exact string in a file.
 * @param {object} parameters
 * @param {string} parameters.path The absolute or relative path to the file
 * @param {string} parameters.old_text The exact text to find
 * @param {string} parameters.new_text The new text to insert
 * @returns {Promise<{success: true, path: string, replacements: number}|{error: string}>}
 */
export default async function editFile({ path, old_text, new_text }) {
  try {
    if (!old_text) {
      return { error: "old_text must not be empty." };
    }

    const contents = await fs.readFile(path, "utf8");
    const escaped = escapeRegExp(old_text);

    if (!new RegExp(escaped).test(contents)) {
      return {
        error:
          "Pattern not found in file. Use read to check the contents and try again.",
      };
    }

    const newContents = contents.replace(new RegExp(escaped), new_text);
    await fs.writeFile(path, newContents, "utf8");
    return { success: true, path, replacements: 1 };
  } catch (e) {
    return { error: e.message };
  }
}
