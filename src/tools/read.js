import fs from "node:fs/promises";

export const name = "read";
export const description =
  "Read the contents of a file or directory given its path. Automatically detects whether the path is a file or directory.";
export const parameters = {
  type: "object",
  required: ["path"],
  properties: {
    path: {
      type: "string",
      description: "The absolute or relative path to the file or directory",
    },
  },
};

/**
 * Reads text content from a file or lists directory contents given its path.
 * @param {object} parameters
 * @param {string} parameters.path - The absolute or relative path to the file or directory
 * @returns {Promise<{content:string}|{contents:string[]}>} - The file contents or directory listing
 */
export default async function read({ path }) {
  const stats = await fs.stat(path);
  if (stats.isDirectory()) {
    const contents = await fs.readdir(path);
    return { contents };
  } else {
    const content = await fs.readFile(path, "utf8");
    return { content };
  }
}
