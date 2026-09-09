import { test } from "node:test";
import { strict as assert } from "node:assert";
import { Commands } from "../src/commands.js";
import { Logger } from "../src/logger.js";
import { makeContext } from "./helpers.js";
import * as help from "../src/commands/help.js";

/**
 * Build a Commands instance with a few fake commands.
 */
function makeTestCommands() {
  const commands = new Commands();
  commands.register(
    "/alpha",
    () => {},
    () => [],
    "First command",
  );
  commands.register(
    "/beta",
    () => {},
    () => [],
    "Second command",
  );
  commands.register(
    "!",
    () => {},
    () => [],
    "Shell passthrough",
  );
  return commands;
}

/**
 * @param {import("node:test").TestContext} t
 */
function makeRecordingContext(t) {
  /** @type {string[]} */
  const logged = [];
  const logger = new Logger({ log: (msg) => logged.push(msg) });
  const context = makeContext(t, logger);
  return { context, logged };
}

test("help run: no name prints all commands", (t) => {
  const commands = makeTestCommands();
  const { context, logged } = makeRecordingContext(t);

  help.default("", context, commands);

  assert.equal(logged.length, 3);
  assert.ok(logged[0].includes("/alpha"));
  assert.ok(logged[1].includes("/beta"));
  assert.ok(logged[2].includes("!"));
});

test("help run: exact name with slash prints that command", (t) => {
  const commands = makeTestCommands();
  const { context, logged } = makeRecordingContext(t);

  help.default("/beta", context, commands);

  assert.equal(logged.length, 1);
  assert.ok(logged[0].includes("Second command"));
});

test("help run: name without slash also works", (t) => {
  const commands = makeTestCommands();
  const { context, logged } = makeRecordingContext(t);

  help.default("beta", context, commands);

  assert.equal(logged.length, 1);
  assert.ok(logged[0].includes("Second command"));
});

test("help run: unknown name prints error", (t) => {
  const commands = makeTestCommands();
  const { context, logged } = makeRecordingContext(t);

  help.default("/nonexistent", context, commands);

  assert.equal(logged.length, 1);
  assert.ok(logged[0].includes("Unknown command"));
});

test("help complete: empty prefix returns all names", (t) => {
  const commands = makeTestCommands();
  const { context } = makeRecordingContext(t);

  const result = help.complete("", context, commands);

  assert.deepEqual(result.sort(), ["!", "/alpha", "/beta"].sort());
});

test("help complete: prefix filters by startsWith", (t) => {
  const commands = makeTestCommands();
  const { context } = makeRecordingContext(t);

  const result = help.complete("/b", context, commands);

  assert.deepEqual(result, ["/beta"]);
});

test("help complete: prefix without slash tries with slash", (t) => {
  const commands = makeTestCommands();
  const { context } = makeRecordingContext(t);

  const result = help.complete("b", context, commands);

  assert.deepEqual(result, ["/beta"]);
});

test("help complete: leading space is stripped", (t) => {
  const commands = makeTestCommands();
  const { context } = makeRecordingContext(t);

  const result = help.complete(" /b", context, commands);

  assert.deepEqual(result, ["/beta"]);
});

test("help complete: leading space without slash tries with slash", (t) => {
  const commands = makeTestCommands();
  const { context } = makeRecordingContext(t);

  const result = help.complete(" b", context, commands);

  assert.deepEqual(result, ["/beta"]);
});

test("Commands.complete: help end-to-end with space", async (t) => {
  const commands = makeTestCommands();
  commands.register("/help", help.default, help.complete, "Show help");
  const { context } = makeRecordingContext(t);

  const result = await commands.complete("/help", context);

  assert.ok(result.includes("/help /alpha"));
  assert.ok(result.includes("/help /beta"));
  assert.ok(result.includes("/help !"));
});

test("Commands.complete: help with user-typed space", async (t) => {
  const commands = makeTestCommands();
  commands.register("/help", help.default, help.complete, "Show help");
  const { context } = makeRecordingContext(t);

  const result = await commands.complete("/help /b", context);

  assert.deepEqual(result, ["/help /beta"]);
});
