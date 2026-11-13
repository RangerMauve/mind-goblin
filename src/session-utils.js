import { ASSISTANT, TOOL, USER } from "./index.js";

/** @import { Goblin, Message } from "./index.js" */

const SUMMARIZE_PROMPT =
  "Summarize the conversation above in a few bullet points. Focus on what was discussed, decisions made, and tasks completed. List the most relevant files that have been worked on.";

/**
 * @typedef {object} CompactStats
 * @property {number} before Message count before compacting
 * @property {number} after Message count after compacting
 * @property {number} thinkingCleared Assistant reasoning blocks stripped
 * @property {number} toolCallsRemoved Assistant tool_calls stripped
 * @property {number} toolResponsesRemoved Tool result messages dropped
 * @property {number} emptyRemoved Empty messages dropped
 */

/**
 * Summarize and compact the first `n` messages of a history.
 *
 * The target messages are mutated in place (tool_calls, reasoning_content and
 * tool results are stripped). The input array itself is NOT spliced — the
 * caller replaces `messages.slice(0, n)` with the returned `compacted` list.
 *
 * @param {Message[]} messages The full history
 * @param {number} n How many oldest messages to compact
 * @param {Goblin} goblin The agent used to generate the summary
 * @param {AbortSignal} [signal]
 * @returns {Promise<{compacted: Message[], stats: CompactStats}>}
 */
export async function compactMessages(messages, n, goblin, signal) {
  n = Math.min(n, messages.length);
  const target = messages.slice(0, n);

  // Summarize before compacting
  /** @type {Message[]} */
  const summaryMessages = [
    ...target,
    { role: USER, content: SUMMARIZE_PROMPT },
  ];
  await goblin.crank(summaryMessages, { signal });
  const summaryMessage = /** @type {Message} */ (summaryMessages.at(-1));

  /** @type {Message[]} */
  const compacted = [];

  let thinkingCleared = 0;
  let toolCallsRemoved = 0;
  let toolResponsesRemoved = 0;
  let emptyRemoved = 0;

  for (const msg of target) {
    if (msg.role === ASSISTANT && msg.tool_calls?.length) {
      delete msg.tool_calls;
      toolCallsRemoved++;
    }
    if (msg.role === TOOL) {
      toolResponsesRemoved++;
      continue; // skip the tool response
    }
    if (msg.role === ASSISTANT && msg.reasoning_content) {
      // Strip reasoning_content
      thinkingCleared++;
      delete msg.reasoning_content;
    }
    if (
      !msg.content ||
      (typeof msg.content === "string" && msg.content.trim() === "")
    ) {
      emptyRemoved++;
      continue; // Skip empty messages
    }
    compacted.push(msg);
  }

  if (summaryMessage) {
    compacted.push(summaryMessage);
  }

  const stats = {
    before: messages.length,
    after: messages.length - n + compacted.length,
    thinkingCleared,
    toolCallsRemoved,
    toolResponsesRemoved,
    emptyRemoved,
  };

  return { compacted, stats };
}
