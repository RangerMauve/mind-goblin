import { color, INFO, playBell } from "../ansi.js";
import { compactMessages } from "../session-utils.js";

/** @import {REPLContext} from "../repl.js" */

export const name = "/compact";
export const description =
  "Summarize and compact the conversation history. Optionally specify how many oldest messages to compact.";

/**
 * @param {string} line
 * @param {REPLContext} context
 * @param {import("../commands.js").Commands} _commands
 * @param {AbortSignal} [signal]
 */
export default async function compact(line, context, _commands, signal) {
  // Determine how many oldest messages to compact
  let n = context.messages.length;
  if (line.trim()) {
    n = parseInt(line.trim(), 10);
    if (Number.isNaN(n) || n <= 0)
      throw new Error(`Invalid value passed to compact: ${line.trim()}`);
  }

  const { compacted, stats } = await compactMessages(
    context.messages,
    n,
    context.goblin,
    signal,
  );

  // Replace the first n messages with the compacted result
  context.messages.splice(0, n, ...compacted);

  const parts = [`${stats.before} → ${stats.after} messages`];
  if (stats.thinkingCleared)
    parts.push(`${stats.thinkingCleared} thinking blocks cleared`);
  if (stats.toolCallsRemoved)
    parts.push(`${stats.toolCallsRemoved} tool call messages removed`);
  if (stats.toolResponsesRemoved)
    parts.push(`${stats.toolResponsesRemoved} tool responses removed`);
  if (stats.emptyRemoved)
    parts.push(`${stats.emptyRemoved} empty messages removed`);

  console.log(
    color(INFO, `Compacted: ${parts.join(", ") || "nothing to remove"}`),
  );
  playBell();
}
