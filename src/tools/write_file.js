import fs from "node:fs/promises";
import { dirname } from "node:path";

export const name = "write_file";
export const readonly = false;
export const description = "Write content to a file given its path.";
export const parameters = {
  type: "object",
  required: ["path", "content"],
  properties: {
    path: {
      type: "string",
      description: "The absolute or relative path to the file",
    },
    content: {
      type: "string",
      description: "The content to write to the file",
    },
  },
};

/**
 * Write content to a file given its path.
 * @param {object} parameters
 * @param {string} parameters.path
 * @param {string} parameters.content
 * @returns {Promise<{success: true, path:string}|{error:string}>}
 */
export default async function writeFile({ path, content }) {
  try {
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, content, "utf8");
    return { success: true, path };
  } catch (e) {
    return { error: e.message };
  }
}
