import { test } from "node:test";
import { strict as assert } from "node:assert";
import compact from "../src/tools/compact.js";
import { Context } from "../src/context.js";
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

/**
 * Build a Context backed by the stub goblin, seeded with the given messages.
 * @param {Message[]} messages
 */
function makeCtx(messages) {
  const ctx = new Context(goblin, null);
  for (const m of messages) ctx.push(m);
  return ctx;
}

test("compacts the whole history when n is omitted", async () => {
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
    { role: TOOL, content: "body", name: "read", tool_call_id: "1" },
    { role: ASSISTANT, content: "done" },
  ];
  const ctx = makeCtx(messages);
  const result = await compact({}, ctx);

  assert.equal(result.before, 4);
  // target all 4 -> [hello, done] kept + SUMMARY = 3
  assert.equal(result.after, 3);
  assert.equal(result.toolCallsRemoved, 1);
  assert.equal(result.toolResponsesRemoved, 1);
  assert.equal(ctx.messages.length, 3);
  assert.equal(ctx.messages.at(-1)?.content, "SUMMARY");
});

test("compacts only the n oldest messages", async () => {
  /** @type {Message[]} */
  const messages = [
    { role: USER, content: "one" },
    { role: ASSISTANT, content: "two" },
    { role: USER, content: "three" },
    { role: ASSISTANT, content: "four" },
  ];
  const ctx = makeCtx(messages);
  const result = await compact({ n: 2 }, ctx);

  // target [one, two] both kept + SUMMARY = 3; after = 4 - 2 + 3 = 5
  assert.equal(result.before, 4);
  assert.equal(result.after, 5);
  assert.equal(ctx.messages.length, 5);
  assert.equal(ctx.messages[3]?.content, "three"); // untouched
  assert.equal(ctx.messages[4]?.content, "four"); // untouched
});

test("errors on an empty history", async () => {
  const ctx = makeCtx([]);
  const result = await compact({}, ctx);
  assert.ok(result.error);
});

test("errors on an invalid n", async () => {
  const ctx = makeCtx([{ role: USER, content: "hi" }]);
  const result = await compact({ n: -1 }, ctx);
  assert.ok(result.error);
});

test("is readonly", async () => {
  const mod = await import("../src/tools/compact.js");
  assert.equal(mod.readonly, true);
});
