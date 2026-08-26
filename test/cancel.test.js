import { test } from "node:test";
import { strict as assert } from "node:assert";
import { EventEmitter } from "node:events";
import { makeCancelSignalResource } from "../src/cancel.js";

test("makeCancelSignalResource returns an un-aborted signal initially", () => {
  const input = new EventEmitter();
  const resource = makeCancelSignalResource(input);
  assert.equal(resource.signal.aborted, false);
  resource[Symbol.dispose]();
});

test("aborts the signal when the escape key is pressed", () => {
  const input = new EventEmitter();
  const resource = makeCancelSignalResource(input);
  input.emit("keypress", "", { name: "escape" });
  assert.equal(resource.signal.aborted, true);
  resource[Symbol.dispose]();
});

test("does not abort on non-escape keypresses", () => {
  const input = new EventEmitter();
  const resource = makeCancelSignalResource(input);
  input.emit("keypress", "a", { name: "a" });
  input.emit("keypress", "", { name: "return" });
  assert.equal(resource.signal.aborted, false);
  resource[Symbol.dispose]();
});

test("does not abort when the key object is missing", () => {
  const input = new EventEmitter();
  const resource = makeCancelSignalResource(input);
  input.emit("keypress", "", null);
  assert.equal(resource.signal.aborted, false);
  resource[Symbol.dispose]();
});

test("dispose removes the keypress listener", () => {
  const input = new EventEmitter();
  const resource = makeCancelSignalResource(input);
  resource[Symbol.dispose]();
  // After dispose, further escape presses should not abort.
  input.emit("keypress", "", { name: "escape" });
  assert.equal(resource.signal.aborted, false);
});
