import { INFO, color, playBell } from "../ansi.js";

/** @import {REPLContext} from "../repl.js" */

export const name = "/clear";

/**
 * @param {string} _
 * @param {REPLContext} context
 * @param {import("../index.js").Goblin} _agent
 * @param {AbortSignal} [signal]
 */
export async function run(_, context, _agent, signal) {
  const count = context.messages.length;
  context.messages.length = 0;
  console.log(color(INFO, `Cleared ${count} messages`));
  playBell();
}
