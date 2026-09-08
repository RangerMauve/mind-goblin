/** @import {REPLContext} from "../repl.js" */

export const name = "/length";
export const description =
  "Show the number of messages in the conversation history.";

/**
 * @param {string} line
 * @param {REPLContext} context
 */
export async function run(line, context) {
  context.logger.info(`${context.messages.length} messages`);
}
