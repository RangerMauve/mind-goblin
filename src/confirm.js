import { makeCancelSignalResource } from "./cancel.js";
import { INFO, WARN, RESET, BELL } from "./ansi.js";

/**
 * @param {import("node:readline/promises").Interface} rl
 * @param {import("node:process").stdin} input
 * @param {{ log?: (...args: unknown[]) => void, error?: (...args: unknown[]) => void }} [logger]
 */
export function makeConfirm(rl, input, { log = console.log, error = console.error } = {}) {
  /**
   * @param {string} prompt
   */
  return async function confirm(prompt) {
    using cancel = makeCancelSignalResource(input);
    try {
      const answer = await rl.question(
        `${prompt}\n> ${INFO}Y${RESET}/${WARN}n${RESET} (${WARN}ESC${RESET} to cancel)${BELL} `,
        { signal: cancel.signal },
      );
      if (answer.trim().toLowerCase() === "n") {
        log("Cancelling.");
        throw new Error(
          "Tool call cancelled by user. Stop what youre doing and ask for clarification.",
        );
      }
    } catch (cause) {
      error("Cancelling");
      throw new Error(
        "Tool call cancelled by user. Stop what youre doing and ask for clarification.",
        { cause },
      );
    }
  };
}
