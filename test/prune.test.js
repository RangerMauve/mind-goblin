import { test } from "node:test";
import { strict as assert } from "node:assert";
import prune from "../src/tools/prune.js";
import { Context } from "../src/context.js";
import { Goblin } from "../src/index.js";

/** @import { Message } from "../src/index.js" */

/**
 * Build a Context with a pre-seeded messages array.
 * @param {Message[]} messages
 */
function makeCtx(messages) {
  const goblin = new Goblin({});
  const ctx = new Context(goblin, null);
  for (const m of messages) ctx.push(m);
  return ctx;
}

test("no args prunes all tool results from previous turn", () => {
  /** @type {Message[]} */
  const messages = [
    { role: "system", content: "sys" },
    { role: "user", content: "hello" },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "1",
          type: "function",
          function: { name: "read", arguments: "{}" },
        },
        {
          id: "2",
          type: "function",
          function: { name: "shell_command", arguments: "{}" },
        },
      ],
    },
    { role: "tool", content: "AAA", name: "read", tool_call_id: "1" },
    { role: "tool", content: "BBB", name: "shell_command", tool_call_id: "2" },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "3",
          type: "function",
          function: { name: "prune", arguments: "{}" },
        },
      ],
    },
  ];

  const ctx = makeCtx(messages);
  const result = prune({}, ctx);

  assert.equal(result.pruned, 2);
  assert.equal(messages[3].content, "[pruned: read (3 chars)]");
  assert.equal(messages[4].content, "[pruned: shell_command (3 chars)]");
});

test("role: tool + matches regex prunes matching tool results", () => {
  /** @type {Message[]} */
  const messages = [
    { role: "user", content: "hi" },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "1",
          type: "function",
          function: { name: "read", arguments: "{}" },
        },
        {
          id: "2",
          type: "function",
          function: { name: "read", arguments: "{}" },
        },
        {
          id: "3",
          type: "function",
          function: { name: "shell_command", arguments: "{}" },
        },
      ],
    },
    { role: "tool", content: "README stuff", name: "read", tool_call_id: "1" },
    { role: "tool", content: "other file", name: "read", tool_call_id: "2" },
    {
      role: "tool",
      content: "npm test output",
      name: "shell_command",
      tool_call_id: "3",
    },
  ];

  const ctx = makeCtx(messages);
  const result = prune({ role: "tool", matches: "^read " }, ctx);

  assert.equal(result.pruned, 2);
  assert.equal(messages[2].content, "[pruned: read (12 chars)]");
  assert.equal(messages[3].content, "[pruned: read (10 chars)]");
  assert.equal(messages[4].content, "npm test output"); // untouched
});

test("limit restricts how many are pruned (from end)", () => {
  /** @type {Message[]} */
  const messages = [
    { role: "user", content: "hi" },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "1",
          type: "function",
          function: { name: "read", arguments: "{}" },
        },
        {
          id: "2",
          type: "function",
          function: { name: "read", arguments: "{}" },
        },
        {
          id: "3",
          type: "function",
          function: { name: "read", arguments: "{}" },
        },
      ],
    },
    { role: "tool", content: "one", name: "read", tool_call_id: "1" },
    { role: "tool", content: "two", name: "read", tool_call_id: "2" },
    { role: "tool", content: "three", name: "read", tool_call_id: "3" },
  ];

  const ctx = makeCtx(messages);
  const result = prune({ role: "tool", limit: 2 }, ctx);

  assert.equal(result.pruned, 2);
  assert.equal(messages[2].content, "one"); // untouched (oldest)
  assert.equal(messages[3].content, "[pruned: read (3 chars)]");
  assert.equal(messages[4].content, "[pruned: read (5 chars)]");
});

test("role: user prunes matching user messages", () => {
  /** @type {Message[]} */
  const messages = [
    { role: "system", content: "sys" },
    { role: "user", content: "please fix the typo in the docs" },
    { role: "assistant", content: "done" },
    { role: "user", content: "actually undo that" },
  ];

  const ctx = makeCtx(messages);
  const result = prune({ role: "user", matches: "typo" }, ctx);

  assert.equal(result.pruned, 1);
  assert.equal(messages[1].content, "[pruned: user (31 chars)]");
  assert.equal(messages[3].content, "actually undo that"); // last user msg protected AND no match
});

test("cannot prune the last user message", () => {
  /** @type {Message[]} */
  const messages = [
    { role: "user", content: "old message" },
    { role: "assistant", content: "response" },
    { role: "user", content: "old message again" },
  ];

  const ctx = makeCtx(messages);
  // Match both user messages, but the last one should be protected
  const result = prune({ role: "user", matches: "old message" }, ctx);

  assert.equal(result.pruned, 1);
  assert.equal(messages[0].content, "[pruned: user (11 chars)]");
  assert.equal(messages[2].content, "old message again"); // protected
});

test("cannot prune system messages", () => {
  /** @type {Message[]} */
  const messages = [
    { role: "system", content: "you are a helpful assistant" },
    { role: "user", content: "hi" },
  ];

  const ctx = makeCtx(messages);
  const result = prune({ matches: "helpful assistant" }, ctx);

  assert.equal(result.pruned, 0);
  assert.equal(messages[0].content, "you are a helpful assistant");
});

test("matches with no role searches all message types", () => {
  /** @type {Message[]} */
  const messages = [
    { role: "user", content: "what is the weather" },
    { role: "assistant", content: "I will check the weather for you" },
    { role: "user", content: "thanks" },
  ];

  const ctx = makeCtx(messages);
  const result = prune({ matches: "weather" }, ctx);

  // Should match user[0] and assistant[1], but user[0] is not the last user msg
  // Actually user[2] "thanks" is the last user message, so user[0] is safe to prune
  assert.equal(result.pruned, 2);
  assert.ok(
    typeof messages[0].content === "string" &&
      messages[0].content.startsWith("[pruned:"),
  );
  assert.ok(
    typeof messages[1].content === "string" &&
      messages[1].content.startsWith("[pruned:"),
  );
  assert.equal(messages[2].content, "thanks");
});

test("invalid regex returns error", () => {
  const ctx = makeCtx([{ role: "user", content: "hi" }]);
  const result = prune({ matches: "[" }, ctx);
  assert.ok(result.error);
});

test("no matches returns 0", () => {
  const ctx = makeCtx([{ role: "user", content: "hi" }]);
  const result = prune({ role: "assistant", matches: "xyz" }, ctx);
  assert.equal(result.pruned, 0);
});

test("prune is readonly", async () => {
  const { readonly } = await import("../src/tools/prune.js");
  assert.equal(readonly, true);
});
