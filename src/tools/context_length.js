/** @import { Context } from "../context.js" */
/** @import { Message } from "../index.js" */

export const name = "context_length";
export const readonly = true;
export const description =
  "Report the size of the current conversation context: the number of messages and their total character count. Use it to gauge how much context is in use before pruning or compacting.";

export const parameters = { type: "object" };

/**
 * Report the number of messages and total character count in the conversation.
 * @param {object} _parameters
 * @param {Context} context
 * @returns {{messages: number, chars: number}}
 */
export default function contextLength(_parameters, context) {
  /** @type {Message[]} */
  const messages = context.messages;
  let chars = 0;
  for (const m of messages) {
    if (typeof m.content === "string") chars += m.content.length;
  }
  return { messages: messages.length, chars };
}
