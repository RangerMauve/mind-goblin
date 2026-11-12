/** @import {REPLContext} from "../repl.js" */

export const name = "/skill";
export const description =
  "List available skills, or /skill <name> to load a skill's instructions into the conversation.";

/**
 * List skills, or load a skill by simulating a read tool call.
 * @param {string} line
 * @param {REPLContext} context
 */
export default async function skill(line, context) {
  const arg = line.trim();
  const skills = context.skills;

  if (!arg) {
    const list = skills.list();
    if (list.length === 0) {
      context.logger.warn("No skills found.");
      return;
    }
    const active = skills.findActive(context.messages);
    for (const s of list) {
      const isActive = active.has(s.name) ? " (active)" : "";
      context.logger.info(`${s.name} — ${s.description}${isActive}`);
    }
    return;
  }

  const record = skills.get(arg);
  if (!record) {
    context.logger.warn(`Unknown skill: ${arg}`);
    return;
  }
  if (skills.findActive(context.messages).has(arg)) {
    context.logger.info(`Skill ${arg} is already in context.`);
    return;
  }

  const id = await skills.loadInto(arg, context.messages);
  if (!id) {
    context.logger.warn(`Unknown skill: ${arg}`);
    return;
  }
  context.logger.info(`Loaded skill ${record.name} (${record.location})`);
}

/**
 * @param {string} prefix
 * @param {REPLContext} context
 * @returns {string[]}
 */
export function complete(prefix, context) {
  return context.skills
    .list()
    .filter((s) => s.name.startsWith(prefix))
    .map((s) => s.name);
}
