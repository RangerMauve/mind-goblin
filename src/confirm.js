import { makeCancelSignalResource } from "./cancel.js";
import { INFO, WARN, RESET, playBell } from "./ansi.js";

/**
 * @param {import("node:readline/promises").Interface} rl
 * @param {import("node:process").stdin} input
 * @param {(...args: unknown[]) => void} [log]
 */
export function makeConfirm(rl, input, log = console.log) {
  /**
   * @param {string} prompt
   */
  return async function confirm(prompt) {
    using cancel = makeCancelSignalResource(input);
    log(prompt)
    playBell()
    try {
      const answer = await rl.question(
        `> ${INFO}Y${RESET}/${WARN}n${RESET} (${WARN}ESC${RESET} to cancel) `,
        { signal: cancel.signal },
      );
      if (answer.trim().toLowerCase() === "n") {
        log("Cancelling.");
        throw new Error(
          "Tool call cancelled by user. Stop what youre doing and ask for clarification.",
        );
      }
    } catch (cause) {
      log("Cancelling");
      throw new Error(
        "Tool call cancelled by user. Stop what youre doing and ask for clarification.",
        { cause },
      );
    }
  };
}
