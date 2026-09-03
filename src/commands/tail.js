import { USER, ASSISTANT, TOOL } from "../index.js";
import { playBell } from "../ansi.js";

/** @import {Message} from "../index.js" */
/** @import {REPLContext} from "../repl.js" */

export const name = "/tail";

const MAX = 50;
const DEFAULT_N = 5;

/**
 * Show the last n user/assistant messages in the conversation.
 * @param {string} line
 * @param {REPLContext} context
 */
export function run(line, context) {
  const n = Math.min(Math.max(parseInt(line.trim()) || DEFAULT_N, 1), MAX);
  const messages = context.messages;
  /** @type {Message[]} */
  const selected = [];
  let count = 0;

  for (let i = messages.length - 1; i >= 0 && count < n; i--) {
    const msg = messages[i];
    if (msg.role === TOOL) continue;
    if (!msg.content) continue;
    count++;
    selected.push(msg);
  }

  selected.reverse();

  for (const msg of selected) {
    if (msg.role === USER) {
      context.logger.user(msg.content.trim());
    } else if (msg.role === ASSISTANT) {
      context.logger.assistant(msg.content.trim());
    }
  }

  if (selected.length > 0) playBell();
}
