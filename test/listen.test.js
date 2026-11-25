import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mergeUserMessages } from "../src/listen.js";
import { ASSISTANT, USER } from "../src/index.js";

/** @import {Message} from "../src/index.js" */

test("pushes a new USER message on an empty history", () => {
  /** @type {Message[]} */
  const messages = [];
  mergeUserMessages(messages, "hello");
  assert.deepEqual(messages, [{ role: USER, content: "hello" }]);
});

test("appends to the most recent USER message", () => {
  /** @type {Message[]} */
  const messages = [
    { role: USER, content: "first" },
    { role: ASSISTANT, content: "hi" },
    { role: USER, content: "do the thing" },
  ];
  mergeUserMessages(messages, "and the other");
  assert.equal(messages.length, 3);
  const last = /** @type {Message} */ (messages.at(-1));
  assert.equal(
    /** @type {string} */ (last.content),
    "do the thing\nand the other",
  );
});

test("pushes a new USER message when the last message is not a USER string", () => {
  /** @type {Message[]} */
  const messages = [{ role: ASSISTANT, content: "hi" }];
  mergeUserMessages(messages, "hello");
  assert.equal(messages.length, 2);
  assert.deepEqual(/** @type {Message} */ (messages.at(-1)), {
    role: USER,
    content: "hello",
  });
});
