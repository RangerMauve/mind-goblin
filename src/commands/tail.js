import { ASSISTANT, checkIsTextContent, TOOL, USER } from "../index.js";

/** @import {Message} from "../index.js" */
/** @import {REPLContext} from "../repl.js" */

export const name = "/tail";
export const description =
  "Show the last n user/assistant messages (default 5)";

const MAX = 50;
const DEFAULT_N = 5;

/**
 * Extract the optional `summary` field from a tool call's JSON arguments.
 * Returns null if absent or the arguments aren't valid JSON.
 * @param {string} rawArgs
 * @returns {string | null}
 */
function toolSummary(rawArgs) {
  try {
    const args = JSON.parse(rawArgs || "{}");
    return typeof args?.summary === "string" && args.summary
      ? args.summary
      : null;
  } catch {
    return null;
  }
}

/**
 * Show the last n user/assistant messages in the conversation.
 * @param {string} line
 * @param {REPLContext} context
 */
export default function tail(line, context) {
  const n = Math.min(Math.max(parseInt(line.trim()) || DEFAULT_N, 1), MAX);
  const messages = context.messages;
  /** @type {Message[]} */
  const selected = [];
  let count = 0;

  for (let i = messages.length - 1; i >= 0 && count < n; i--) {
    const msg = messages[i];
    if (msg.role === TOOL) continue;
    if (!msg.content && !(msg.role === ASSISTANT && msg.tool_calls?.length))
      continue;
    count++;
    selected.push(msg);
  }

  selected.reverse();

  for (const msg of selected) {
    if (msg.role === USER) {
      context.logger.user(checkIsTextContent(msg).trim());
    } else if (msg.role === ASSISTANT) {
      if (msg.tool_calls?.length) {
        for (const call of msg.tool_calls) {
          const summary = toolSummary(call.function.arguments);
          context.logger.tool(
            summary
              ? `→ ${call.function.name}: ${summary}`
              : `→ ${call.function.name}`,
          );
        }
      }
      if (msg.content?.trim()) context.logger.assistant(msg.content.trim());
    }
  }

  if (selected.length === 0) context.logger.warn("No history found");
}
