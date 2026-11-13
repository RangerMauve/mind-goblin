import { test } from "node:test";
import { strict as assert } from "node:assert";
import contextLength from "../src/tools/context_length.js";
import { Context } from "../src/context.js";
import { ASSISTANT, USER } from "../src/index.js";

/** @import { Message } from "../src/index.js" */

/**
 * Build a bare Context seeded with the given messages.
 * @param {Message[]} messages
 */
function makeCtx(messages) {
  const ctx = new Context(/** @type {any} */ ({}), null);
  for (const m of messages) ctx.push(m);
  return ctx;
}

test("reports message count and total character count", () => {
  /** @type {Message[]} */
  const messages = [
    { role: USER, content: "hello" }, // 5
    { role: ASSISTANT, content: "world!" }, // 6
  ];
  const ctx = makeCtx(messages);
  const result = contextLength({}, ctx);

  assert.equal(result.messages, 2);
  assert.equal(result.chars, 11);
});

test("counts empty history as zero", () => {
  const ctx = makeCtx([]);
  const result = contextLength({}, ctx);
  assert.equal(result.messages, 0);
  assert.equal(result.chars, 0);
});

test("is readonly", async () => {
  const mod = await import("../src/tools/context_length.js");
  assert.equal(mod.readonly, true);
});
