import { test } from "node:test";
import { strict as assert } from "node:assert";
import { makeCommands, makeRecordingContext } from "./helpers.js";

test("fork command: creates a new session with the given name", async (t) => {
  const commands = await makeCommands("fork");
  const { context, logged } = makeRecordingContext(t);

  await commands.run("/fork my-branch", context);

  assert.equal(context.sessionName, "my-branch");
  assert.deepEqual(logged, [`Forked to session "my-branch"`]);
});

test("fork command: falls back to <session>_fork when no name given", async (t) => {
  const commands = await makeCommands("fork");
  const { context, logged } = makeRecordingContext(t);

  assert.equal(context.sessionName, "default");
  await commands.run("/fork", context);

  assert.equal(context.sessionName, "default_fork");
  assert.deepEqual(logged, [`Forked to session "default_fork"`]);
});

test("fork command: trims whitespace around the name", async (t) => {
  const commands = await makeCommands("fork");
  const { context } = makeRecordingContext(t);

  await commands.run("/fork   padded  ", context);

  assert.equal(context.sessionName, "padded");
});

test("fork command: empty name falls back to default", async (t) => {
  const commands = await makeCommands("fork");
  const { context } = makeRecordingContext(t);

  await commands.run("/fork   ", context);

  assert.equal(context.sessionName, "default_fork");
});

test("fork command: command is registered under /fork", async () => {
  const commands = await makeCommands("fork");
  assert.equal(commands.has("/fork"), true);
});
