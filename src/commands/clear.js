/** @import {REPLContext} from "../repl.js" */

export const name = "/clear";
export const description =
  "Clear the conversation history. Optionally specify how many recent entries to clear. Negative numbers clear from oldest messages.";

/**
 * @param {string} line
 * @param {REPLContext} context
 */
export async function run(line, context) {
  const count = context.messages.length;
  if (line.trim()) {
    const amount = parseInt(line.trim());
    if (Number.isNaN(amount))
      throw new Error("Invalid value passed to clear " + amount);
    if (amount <= 0) {
      // Clear from oldest messages
    } else {
      // Clear from most recent
      context.messages.length -= amount;
    }
  } else {
    context.messages.length = 0;
  }
  const cleared = count - context.messages.length;
  context.logger.info(`Cleared ${cleared} messages`);
}
