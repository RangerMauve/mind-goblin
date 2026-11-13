import { test } from "node:test";
import { strict as assert } from "node:assert";
import { compactMessages } from "../src/session-utils.js";
import { ASSISTANT, TOOL, USER } from "../src/index.js";

/** @import { Goblin, Message } from "../src/index.js" */

/** A goblin stub whose crank appends a canned summary message (no LLM). */
const goblin = /** @type {Goblin} */ (
  /** @type {unknown} */ ({
    /** @param {Message[]} msgs */
    async crank(msgs) {
      msgs.push({ role: ASSISTANT, content: "SUMMARY" });
    },
  })
);

test("compacts the first n messages and appends a summary", async () => {
  /** @type {Message[]} */
  const messages = [
    { role: USER, content: "hello" },
    {
      role: ASSISTANT,
      content: "",
      tool_calls: [
        {
          id: "1",
          type: "function",
          function: { name: "read", arguments: "{}" },
        },
      ],
    },
    { role: TOOL, content: "file body", name: "read", tool_call_id: "1" },
    { role: ASSISTANT, content: "done" },
    { role: USER, content: "next" },
  ];

  const { compacted, stats } = await compactMessages(messages, 4, goblin);

  // target = [user, assistant(tool_calls, empty), tool, assistant "done"]
  // -> user kept, assistant stripped+empty (dropped), tool dropped, "done" kept
  // -> compacted = [hello, done, SUMMARY]
  assert.equal(stats.before, 5);
  assert.equal(stats.toolCallsRemoved, 1);
  assert.equal(stats.toolResponsesRemoved, 1);
  assert.equal(stats.emptyRemoved, 1);
  assert.equal(compacted.length, 3);
  assert.equal(compacted[0]?.content, "hello");
  assert.equal(compacted.at(-1)?.content, "SUMMARY");
  // message 4 ("next") is outside the target, untouched
  assert.equal(messages[4]?.content, "next");
  // after = 5 - 4 + 3 = 4
  assert.equal(stats.after, 4);
});

test("strips reasoning_content and counts it", async () => {
  /** @type {Message[]} */
  const messages = [
    { role: USER, content: "hello" },
    {
      role: ASSISTANT,
      content: "done",
      reasoning_content: "let me think...",
    },
  ];

  const { compacted, stats } = await compactMessages(messages, 2, goblin);

  assert.equal(stats.thinkingCleared, 1);
  assert.equal(compacted[0]?.content, "hello");
  // the assistant message is kept but its reasoning is gone
  assert.equal(compacted[1]?.role, ASSISTANT);
  assert.equal(/** @type {any} */ (compacted[1]).reasoning_content, undefined);
});

test("clamps n to the message count", async () => {
  /** @type {Message[]} */
  const messages = [
    { role: USER, content: "one" },
    { role: ASSISTANT, content: "two" },
  ];

  const { compacted, stats } = await compactMessages(messages, 99, goblin);

  assert.equal(stats.before, 2);
  // both kept + summary
  assert.equal(compacted.length, 3);
  assert.equal(stats.after, 3);
});
