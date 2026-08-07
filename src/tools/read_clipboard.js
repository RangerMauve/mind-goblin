import { clipboard } from "clipboard-sys";
import { execa } from "execa";

export const name = "read_clipboard";
export const description =
  "Reads text directly from the system clipboard. Also use this if the user is asking about some text but hasn't provided any. This function has no additional arguments";
export const parameters = { type: "object" };

const isWayland = process.env.XDG_SESSION_TYPE === "wayland";

/**
 * Reads text directly from the system clipboard.
 * @returns {Promise<{clipboardText: string}>}
 */
export default async function readClipboard() {
  return {
    clipboardText: await read(),
  };
}

/**
 *
 * @returns {Promise<string>}
 */
async function read() {
  if (isWayland) {
    const { stdout } = await execa`wl-paste --no-newline`;
    return stdout;
  }
  return clipboard.readText();
}
