/** @import {REPLContext} from "../repl.js" */

export const name = "/fork";
export const description =
  "Fork the current history into a new session. Usage: /fork [name]";

/**
 * @param {string} line
 * @param {REPLContext} context
 */
export default async function fork(line, context) {
  const name = line.trim() || `${context.sessionName}_fork`;
  await context.forkSession(name);
  context.logger.info(`Forked to session "${name}"`);
}
