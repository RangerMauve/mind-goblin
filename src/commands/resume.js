/** @import {REPLContext} from "../repl.js" */

export const name = "/resume";
export const description = "Crank again without resetting the history";

/**
 * @param {string} _
 * @param {REPLContext} context
 * @param {import("../commands.js").Commands} _commands
 * @param {AbortSignal} [signal]
 */
export default async function resume(_, context, _commands, signal) {
  if (context.messages.length === 0) {
    context.logger.warn("Nothing to resume — history is empty");
    return;
  }
  await context.crank(signal);
}
