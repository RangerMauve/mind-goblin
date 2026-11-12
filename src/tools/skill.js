/** @import { Context } from "../context.js" */

export const name = "skill";
export const readonly = true;
export const description =
  "Load a skill's full instructions into the conversation. Available skills and their descriptions are listed under Available Skills in the system prompt.";

export const parameters = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "The name of the skill to load.",
    },
  },
  required: ["name"],
};

/**
 * Load a skill into the conversation by injecting a simulated read.
 * @param {{name: string}} parameters
 * @param {Context} context
 * @returns {Promise<{loaded: string} | {active: boolean, message: string} | {error: string}>}
 */
export default async function skill({ name }, context) {
  const skills = context.goblin.skills;
  if (!skills) {
    return { error: "Skills are not available in this session." };
  }
  if (!skills.get(name)) {
    return { error: `Unknown skill: ${name}` };
  }
  if (skills.findActive(context.messages).has(name)) {
    return { active: true, message: `Skill ${name} is already in context.` };
  }
  await skills.loadInto(name, context.messages);
  return { loaded: name };
}
