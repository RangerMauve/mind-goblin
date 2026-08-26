/** @import { Goblin } from "../index.js" */

export const name = "sub_agent";
export const readonly = true;
export const description =
  "Spawn a sub-agent with more limited tools. Use this to process larger amounts of context to keep the top level memory clean";

export const parameters = {
  type: "object",
  properties: {
    prompt: {
      type: "string",
      description:
        "Instructions for the sub-agent to follow. Be precise with what it is supposed to do.",
    },
    maxIterations: {
      type: "number",
      description:
        "How many loops the agent should be allowed to do before giving up",
    },
    tools: {
      type: "array",
      items: {
        type: "string",
      },
      description: "Which tools to limit the agent to",
    },
    readonly: {
      type: "boolean",
      description: "Whether the sub-agent can use write and edit tools",
      default: true,
    },
  },
  required: ["prompt"],
};

/**
 * Spawn a sub agent.
 * @param {object} parameters
 * @param {string} parameters.prompt,
 * @param {number} [parameters.maxIterations],
 * @param {string[]} [parameters.tools],
 * @param {boolean} [parameters.readonly],
 * @param {Goblin} agent
 * @returns {Promise<{content: string}|{error: string}>}
 */
export default async function subAgent(
  { prompt, maxIterations, tools, readonly = true },
  agent,
) {
  try {
    const sub = agent.fork({ maxIterations, tools, readonly });

    const content = await sub.query(prompt);

    console.log({ prompt, content });

    return { content };
  } catch (e) {
    return { error: `Unable to complete sub-agent task: ${e.message}` };
  }
}
