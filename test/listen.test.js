import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mergeUserMessages, stripTrigger } from "../src/listen.js";
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

test("stripTrigger returns null when the trigger is absent", () => {
  assert.equal(stripTrigger("hello there", "execute"), null);
});

test("stripTrigger returns empty string for a bare trigger", () => {
  assert.equal(stripTrigger("execute", "execute"), "");
  assert.equal(stripTrigger("  Execute!  ", "execute"), "");
});

test("stripTrigger keeps the full line when the trigger has other words", () => {
  assert.equal(stripTrigger("execute the plan", "execute"), "execute the plan");
  assert.equal(
    stripTrigger("please EXECUTE now", "execute"),
    "please EXECUTE now",
  );
});

test("stripTrigger does not match a longer word containing the trigger", () => {
  assert.equal(stripTrigger("executed the task", "execute"), null);
  assert.equal(stripTrigger("executable file", "execute"), null);
});

test("stripTrigger handles regex-special characters in the trigger", () => {
  assert.equal(stripTrigger("a.b", "a.b"), "");
  assert.equal(stripTrigger("do the a.b thing", "a.b"), "do the a.b thing");
  assert.equal(stripTrigger("do the axb thing", "a.b"), null);
});
