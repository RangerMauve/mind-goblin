import { INFO, color, playBell } from "../ansi.js";

/** @import {REPLContext} from "../repl.js" */

export const name = "/clear";
export const description = "Clear the conversation history";

/**
 * @param {string} _
 * @param {REPLContext} context
 */
export async function run(_, context) {
  const count = context.messages.length;
  context.messages.length = 0;
  console.log(color(INFO, `Cleared ${count} messages`));
  playBell();
}
