/** @import { Context } from "../context.js" */
import { compactMessages } from "../session-utils.js";

export const name = "compact";
export const readonly = true;
export const description =
  "Summarize and compact the oldest messages in the conversation to free up context. Pass a count to compact only that many oldest messages; omit it to compact the whole history. The compacted messages are replaced by a short summary, so use it when early turns are no longer needed verbatim.";

export const parameters = {
  type: "object",
  properties: {
    n: {
      type: "number",
      description:
        "How many oldest messages to compact. Omit to compact the entire history.",
    },
  },
};

/**
 * Summarize and compact the conversation history.
 * @param {object} parameters
 * @param {number} [parameters.n] How many oldest messages to compact
 * @param {Context} context
 * @param {AbortSignal} [signal]
 */
export default async function compact({ n }, context, signal) {
  const messages = context.messages;
  if (!messages || messages.length === 0) {
    return { error: "No active conversation to compact." };
  }

  const count = n ?? messages.length;
  if (!Number.isInteger(count) || count <= 0) {
    return { error: `Invalid message count: ${n}` };
  }

  const { compacted, stats } = await compactMessages(
    messages,
    count,
    context.goblin,
    signal,
  );
  messages.splice(0, count, ...compacted);

  return {
    before: stats.before,
    after: stats.after,
    thinkingCleared: stats.thinkingCleared,
    toolCallsRemoved: stats.toolCallsRemoved,
    toolResponsesRemoved: stats.toolResponsesRemoved,
    emptyRemoved: stats.emptyRemoved,
    message: `Compacted: ${stats.before} → ${stats.after} messages.`,
  };
}
