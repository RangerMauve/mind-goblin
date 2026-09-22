import fs from "node:fs/promises";
import { extname } from "node:path";

export const name = "read";
export const readonly = true;
export const description =
  "Read the contents of a file or directory given its path. Automatically detects whether the path is a file or directory. Returns base64 image data for image files.";
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

/** @type {Record<string, string>} */
const IMAGE_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

/**
 * Reads text content from a file, returns base64 image data for image files, or lists directory contents.
 * @param {object} parameters
 * @param {string} parameters.path - The absolute or relative path to the file or directory
 * @returns {Promise<{content:string}|{contents:string[]}|{image:{data:string,mime:string}}>}
 */
export default async function read({ path: filePath }) {
  const stats = await fs.stat(filePath);
  if (stats.isDirectory()) {
    const contents = await fs.readdir(filePath);
    return { contents };
  }

  const mime = IMAGE_MIME[extname(filePath).toLowerCase()];
  if (mime) {
    const buffer = await fs.readFile(filePath);
    return { image: { data: buffer.toString("base64"), mime } };
  }

  const content = await fs.readFile(filePath, "utf8");
  return { content };
}
