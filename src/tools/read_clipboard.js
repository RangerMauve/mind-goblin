import { clipboard } from 'clipboard-sys'
import { execa } from 'execa'

export const name = 'read_clipboard'
export const description = 'Read text from the system clipboard. Use this if the user is asking about some text but hasn\'t provided any. This function has no additional arguments'
export const parameters = { type: 'object' }

const isWayland = process.env.XDG_SESSION_TYPE === 'wayland'

export default async function readClipboard () {
  if (isWayland) {
    const { stdout } = await execa`wl-paste`
    return stdout
  }
  return clipboard.readText()
}
