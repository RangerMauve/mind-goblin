import { test } from "node:test";
import { strict as assert } from "node:assert";
import { Commands } from "../src/commands.js";
import { Logger } from "../src/logger.js";
import { makeContext } from "./helpers.js";

async function makeForkCommands() {
  const commands = new Commands();
  await commands.load("fork");
  return commands;
}

/**
 * Build a context with a logger that captures info calls.
 * @param {import("node:test").TestContext} t The test context for cleanup registration
 */
function makeContextWithLogger(t) {
  /** @type {string[]} */
  const info = [];
  /** @type {Logger} */
  const logger = {
    info: (msg) => info.push(msg),
    assistant: () => {},
    user: () => {},
    tool: () => {},
    quiet: () => {},
    warn: () => {},
  };
  const context = makeContext(t, logger);
  return { context, info };
}

test("fork command: creates a new session with the given name", async (t) => {
  const commands = await makeForkCommands();
  const { context, info } = makeContextWithLogger(t);

  await commands.run("/fork my-branch", context);

  assert.equal(context.sessionName, "my-branch");
  assert.deepEqual(info, [`Forked to session "my-branch"`]);
});

test("fork command: falls back to <session>_fork when no name given", async (t) => {
  const commands = await makeForkCommands();
  const { context, info } = makeContextWithLogger(t);

  assert.equal(context.sessionName, "default");
  await commands.run("/fork", context);

  assert.equal(context.sessionName, "default_fork");
  assert.deepEqual(info, [`Forked to session "default_fork"`]);
});

test("fork command: trims whitespace around the name", async (t) => {
  const commands = await makeForkCommands();
  const { context } = makeContextWithLogger(t);

  await commands.run("/fork   padded  ", context);

  assert.equal(context.sessionName, "padded");
});

test("fork command: empty name falls back to default", async (t) => {
  const commands = await makeForkCommands();
  const { context } = makeContextWithLogger(t);

  await commands.run("/fork   ", context);

  assert.equal(context.sessionName, "default_fork");
});

test("fork command: command is registered under /fork", async () => {
  const commands = await makeForkCommands();
  assert.equal(commands.has("/fork"), true);
});
