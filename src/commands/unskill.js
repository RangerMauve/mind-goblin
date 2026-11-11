/** @import {REPLContext} from "../repl.js" */

export const name = "/unskill";
export const description =
  "List active skills, or /unskill <name> to remove a loaded skill's instructions from the conversation.";

/**
 * List active skills, or unload one by removing its simulated read
 * tool call and result from the conversation.
 * @param {string} line
 * @param {REPLContext} context
 */
export default function unskill(line, context) {
  const arg = line.trim();
  const skills = context.skills;

  if (!arg) {
    const active = skills.findActive(context.messages);
    if (active.size === 0) {
      context.logger.warn("No active skills.");
      return;
    }
    for (const name of active) context.logger.info(name);
    return;
  }

  if (!skills.unloadFrom(arg, context.messages)) {
    context.logger.warn(`Skill ${arg} is not active.`);
    return;
  }
  context.logger.info(`Unloaded skill ${arg}`);
}

/**
 * @param {string} prefix
 * @param {REPLContext} context
 * @returns {string[]}
 */
export function complete(prefix, context) {
  return [...context.skills.findActive(context.messages)].filter((n) =>
    n.startsWith(prefix),
  );
}
