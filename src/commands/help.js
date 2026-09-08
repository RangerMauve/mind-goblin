/** @import {REPLContext} from "../repl.js" */
/** @import {Commands} from "../commands.js" */

export const name = "/help";
export const description = "Show help for commands or all commands";

/**
 * @param {string} line
 * @param {REPLContext} context
 * @param {Commands} commands
 */
export default function help(line, context, commands) {
  const name = line.trim();
  const descs = commands.descriptions();

  if (!name) {
    for (const [cmd, description] of descs) {
      context.logger.info(`${cmd} — ${description}`);
    }
  } else {
    let description = descs.get(name) ?? descs.get(`/${name}`);
    if (description) {
      context.logger.info(description);
    } else {
      context.logger.warn(`Unknown command: ${name}`);
    }
  }
}

/**
 * @param {string} prefix
 * @param {REPLContext} _ctx
 * @param {Commands} commands
 * @returns {string[]}
 */
export function complete(prefix, _ctx, commands) {
  let nameStart = prefix.trim();
  if (!nameStart) return commands.names();
  const names = commands.names();
  if (names.includes(nameStart)) return [nameStart];
  if (!nameStart.startsWith("/")) nameStart = "/" + nameStart;
  return names.filter((n) => n.startsWith(nameStart));
}
