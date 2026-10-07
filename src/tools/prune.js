/** @import { Context } from "../context.js" */
/** @import { Message } from "../index.js" */

export const name = "prune";
export const readonly = true;
export const description =
  "Removes tool results or messages from your context to free space. With no arguments, removes all tool results from the previous turn. With arguments, matches messages from the end of history using role and/or regex.";

export const parameters = {
  type: "object",
  properties: {
    role: {
      type: "string",
      enum: ["user", "assistant", "tool"],
      description: "Only match messages with this role.",
    },
    matches: {
      type: "string",
      description:
        "A regex (source only) to match against message content. For tool messages, matches against 'name content'.",
    },
    limit: {
      type: "number",
      description:
        "Prune at most this many matches (counting from the end). Defaults to all matches.",
    },
  },
};

/**
 * Build the string that the regex will match against.
 * @param {Message} msg
 * @returns {string}
 */
function matchTarget(msg) {
  if (msg.role === "tool") {
    const name = /** @type {{name?: string}} */ (msg).name ?? "";
    return `${name} ${msg.content}`;
  }
  return typeof msg.content === "string" ? msg.content : "";
}

/**
 * Find the index of the last user message.
 * @param {Message[]} messages
 * @returns {number} Index, or -1 if none
 */
function lastUserIdx(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return i;
  }
  return -1;
}

/**
 * Remove messages from the context's history.
 * @param {object} parameters
 * @param {string} [parameters.role] - Role to filter by
 * @param {string} [parameters.matches] - Regex source to match content
 * @param {number} [parameters.limit] - Max matches to prune (from end)
 * @param {Context} context
 */
export default function prune({ role, matches, limit }, context) {
  /** @type {Message[]} */
  const messages = context.messages;
  if (!messages || messages.length === 0) {
    return { error: "No active conversation to prune." };
  }

  const protectedIdx = lastUserIdx(messages);

  let regex;
  if (matches) {
    try {
      regex = new RegExp(matches);
    } catch {
      return { error: `Invalid regex: ${matches}` };
    }
  }

  // No args: prune all tool results from the previous turn
  if (!role && !matches) {
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        const a = /** @type {import("../index.js").AssistantMessage} */ (
          messages[i]
        );
        if (a.tool_calls?.length) {
          lastAssistantIdx = i;
          break;
        }
      }
    }
    if (lastAssistantIdx === -1) {
      return { pruned: 0, message: "No previous turn to prune." };
    }
    let count = 0;
    for (let i = lastAssistantIdx - 1; i >= 0; i--) {
      if (messages[i].role !== "tool") break;
      if (i === protectedIdx) continue;
      const msg = messages[i];
      const len = msg.content?.length ?? 0;
      const name = /** @type {{name?: string}} */ (msg).name ?? "tool";
      msg.content = `[pruned: ${name} (${len} chars)]`;
      count++;
    }
    return { pruned: count, message: `Pruned ${count} tool result(s).` };
  }

  // With args: scan from end, match by role + regex, apply limit
  /** @type {number[]} */
  const matched = [];
  const max = limit ?? Infinity;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (matched.length >= max) break;
    if (i === protectedIdx) continue;
    const msg = messages[i];
    if (msg.role === "system") continue;
    if (role && msg.role !== role) continue;
    if (regex && !regex.test(matchTarget(msg))) continue;
    matched.push(i);
  }

  if (matched.length === 0) {
    return { pruned: 0, message: "No matching messages found." };
  }

  for (const idx of matched) {
    const msg = messages[idx];
    const len = msg.content?.length ?? 0;
    const label =
      msg.role === "tool"
        ? `${/** @type {{name?: string}} */ (msg).name ?? "tool"} (${len} chars)`
        : `${msg.role} (${len} chars)`;
    msg.content = `[pruned: ${label}]`;
  }

  return {
    pruned: matched.length,
    message: `Pruned ${matched.length} message(s).`,
  };
}
