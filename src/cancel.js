/**
 * @typedef {object} CancelResorce
 * @property {AbortSignal} signal
 * @property {() => void} Symbol.dispose
 */

/**
 * Creates a resource that provides an AbortSignal which aborts when the Escape key is pressed.
 * The listener is automatically removed when the resource is disposed.
 *
 * @param {import('node:readline').Interface} input - The input stream to listen for keypresses on.
 * @returns {CancelResource}
 */
export function makeCancelSignalResource (input) {
  const controller = new AbortController()

  /**
   * @param {string} str
   * @param {{ name: string }} key
   */
  const onKeypress = (str, key) => {
    if (key && key.name === 'escape') {
      controller.abort()
    }
  }

  input.on('keypress', onKeypress)

  return {
    signal: controller.signal,
    [Symbol.dispose] () {
      input.removeListener('keypress', onKeypress)
    }
  }
}
