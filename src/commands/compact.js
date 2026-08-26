import { ASSISTANT, TOOL, USER } from "../index.js";
import { INFO, color, playBell } from "../ansi.js";

/** @import {Message} from "../index.js" */
/** @import {REPLContext} from "../repl.js" */

export const name = "/compact";

/**
 * @param {string} _
 * @param {REPLContext} context
 * @param {import("../index.js").Goblin} _agent
 * @param {AbortSignal} [signal]
 */
export async function run(_, context, _agent, signal) {
  // Summarize before compacting
  /** @type {Message[]} */
  const summaryMessages = [
    ...context.messages,
    {
      role: USER,
      content:
        "Summarize the conversation above in a few bullet points. Focus on what was discussed, decisions made, and tasks completed. List the most relevant files that have been worked on.",
    },
  ];
  await context.goblin.crank(summaryMessages, {
    listenForCancel: () =>
      signal ? { signal, [Symbol.dispose]: () => {} } : null,
  });
  const summaryMessage = /** @type {Message} */ (summaryMessages.at(-1));

  /** @type {Message[]} */
  const compacted = [];

  let thinkingCleared = 0;
  let toolCallsRemoved = 0;
  let toolResponsesRemoved = 0;
  let emptyRemoved = 0;

  for (const msg of context.messages) {
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

  const before = context.messages.length;

  // Replace messages in context
  context.messages.length = 0;
  context.messages.push(...compacted);

  const after = context.messages.length;

  const parts = [`${before} → ${after} messages`];
  if (thinkingCleared) parts.push(`${thinkingCleared} thinking blocks cleared`);
  if (toolCallsRemoved)
    parts.push(`${toolCallsRemoved} tool call messages removed`);
  if (toolResponsesRemoved)
    parts.push(`${toolResponsesRemoved} tool responses removed`);
  if (emptyRemoved) parts.push(`${emptyRemoved} empty messages removed`);

  console.log(
    color(INFO, `Compacted: ${parts.join(", ") || "nothing to remove"}`),
  );
  playBell();
}
