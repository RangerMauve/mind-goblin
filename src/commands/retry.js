import { USER } from "../index.js";

/** @import {REPLContext} from "../repl.js" */

export const name = "/retry";
export const description = "Remove the last assistant response and re-crank";

/**
 * @param {string} _
 * @param {REPLContext} context
 * @param {import("../commands.js").Commands} _commands
 * @param {AbortSignal} [signal]
 */
export default async function retry(_, context, _commands, signal) {
  const msgs = context.messages;
  const lastUserIdx = msgs.findLastIndex((m) => m.role === USER);
  if (lastUserIdx < 0) {
    context.logger.warn("No user message to retry");
    return;
  }
  msgs.length = lastUserIdx + 1;
  await context.crank(signal);
}
