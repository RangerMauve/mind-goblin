import { execa } from "execa";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const name = "screenshot";
export const readonly = true;
export const description =
  "Take a screenshot of the full screen on Wayland. Returns the image data.";
export const parameters = { type: "object" };

/**
 * Take a screenshot of the full screen using grim.
 * @param {object} _parameters
 * @param {unknown} [_agent]
 * @param {AbortSignal} [cancelSignal]
 * @returns {Promise<{image: {data: string, mime: string}}>}
 */
export default async function screenshot(_parameters, _agent, cancelSignal) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "grim-"));
  const file = path.join(dir, "shot.png");
  try {
    await execa({ cancelSignal })`grim ${file}`;
    const buffer = await fs.readFile(file);
    return { image: { data: buffer.toString("base64"), mime: "image/png" } };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
