import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Goblin } from "../src/index.js";
import { REPLContext } from "../src/repl.js";
import { Sessions } from "../src/sessions.js";
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

/**
 * Build a REPLContext with a temp session folder containing the given session files.
 * @param {import("node:test").TestContext} t
 * @param {string[]} names Session names to create
 */
async function makeContextWithSessions(t, names) {
  const dir = await mkdtemp(join(tmpdir(), "mg-fork-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dirSlug = process.cwd().replaceAll("/", "__");
  for (const name of names) {
    await writeFile(join(dir, `${dirSlug}__${name}.session.json`), "[]");
  }
  const sessions = new Sessions(dir);
  const session = sessions.make("default");
  const goblin = new Goblin({});
  return new REPLContext(goblin, session);
}

test("fork complete: returns all session names for empty prefix", async (t) => {
  const commands = await makeCommands("fork");
  const context = await makeContextWithSessions(t, [
    "alpha",
    "default",
    "zeta",
  ]);

  const completions = await commands.complete("/fork", context);
  assert.deepEqual(completions, ["/fork alpha", "/fork default", "/fork zeta"]);
});

test("fork complete: filters by prefix", async (t) => {
  const commands = await makeCommands("fork");
  const context = await makeContextWithSessions(t, ["foo", "foobar", "bar"]);

  const completions = await commands.complete("/fork fo", context);
  assert.deepEqual(completions, ["/fork foo", "/fork foobar"]);
});
