/** @import { Context } from "../context.js" */

export const name = "unskill";
export const readonly = true;
export const description =
  "Unload a skill's instructions from the conversation to free context space.";

export const parameters = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "The name of the skill to unload.",
    },
  },
  required: ["name"],
};

/**
 * Unload a skill from the conversation.
 * @param {object} parameters
 * @param {string} parameters.name
 * @param {Context} context
 * @returns {{unloaded: string} | {error: string}}
 */
export default function unskill({ name }, context) {
  const skills = context.goblin.skills;
  if (!skills) {
    return { error: "Skills are not available in this session." };
  }
  if (!skills.get(name)) {
    return { error: `Unknown skill: ${name}` };
  }
  if (!skills.unloadFrom(name, context.messages)) {
    return { error: `Skill ${name} is not currently loaded.` };
  }
  return { unloaded: name };
}
