import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Skills } from "../src/skills.js";
import { makeCommands, makeRecordingContext } from "./helpers.js";

const DEMO = `---
name: demo
description: A demo skill for testing.
---
Demo instructions.
`;

/** @type {string} */
let base;
/** @type {Skills} */
let skills;
/** @type {Awaited<ReturnType<typeof makeCommands>>} */
let commands;

before(async () => {
  base = await fs.mkdtemp(path.join(os.tmpdir(), "skill-command-test-"));
  const dir = path.join(base, "demo");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "SKILL.md"), DEMO);
  skills = new Skills([base]);
  await skills.discover();
  commands = await makeCommands("skill", "unskill");
});

after(async () => {
  await fs.rm(base, { recursive: true, force: true });
});

test("/skill lists skills with descriptions", async (t) => {
  const { context, logged } = makeRecordingContext(t, { skills });
  await commands.run("/skill", context);
  assert.deepEqual(logged, ["demo — A demo skill for testing."]);
});

test("/skill <name> loads the skill as a simulated read", async (t) => {
  const { context, logged } = makeRecordingContext(t, { skills });
  await commands.run("/skill demo", context);
  assert.equal(context.messages.length, 2);
  const [assistant, tool] = context.messages;
  assert.equal(assistant.role, "assistant");
  const call = assistant.tool_calls?.[0];
  assert.ok(call);
  assert.ok(call.id?.startsWith("skill_demo_"));
  assert.equal(tool.role, "tool");
  assert.match(/** @type {string} */ (tool.content), /Demo instructions/);
  assert.match(/** @type {string} */ (logged.at(-1)), /Loaded skill demo/);
});

test("/skill shows active skills in the listing", async (t) => {
  const { context, logged } = makeRecordingContext(t, { skills });
  await commands.run("/skill demo", context);
  await commands.run("/skill", context);
  assert.deepEqual(logged.at(-1), "demo — A demo skill for testing. (active)");
});

test("/skill warns on unknown names", async (t) => {
  const { context, logged } = makeRecordingContext(t, { skills });
  await commands.run("/skill nope", context);
  assert.deepEqual(logged, ["Unknown skill: nope"]);
  assert.equal(context.messages.length, 0);
});

test("/unskill lists active skills and unloads by name", async (t) => {
  const { context, logged } = makeRecordingContext(t, { skills });
  await commands.run("/skill demo", context);
  await commands.run("/unskill", context);
  assert.deepEqual(logged.at(-1), "demo");
  await commands.run("/unskill demo", context);
  assert.equal(context.messages.length, 0);
  assert.deepEqual(skills.findActive(context.messages), new Set());
  assert.match(/** @type {string} */ (logged.at(-1)), /Unloaded skill demo/);
});

test("/unskill warns for inactive skills", async (t) => {
  const { context, logged } = makeRecordingContext(t, { skills });
  await commands.run("/unskill", context);
  assert.deepEqual(logged, ["No active skills."]);
  await commands.run("/unskill demo", context);
  assert.deepEqual(logged.at(-1), "Skill demo is not active.");
});

test("completions suggest skill and active skill names", async (t) => {
  const { context } = makeRecordingContext(t, { skills });
  assert.deepEqual(await commands.complete("/skill d", context), [
    "/skill demo",
  ]);
  assert.deepEqual(await commands.complete("/unskill d", context), []);
  await commands.run("/skill demo", context);
  assert.deepEqual(await commands.complete("/unskill d", context), [
    "/unskill demo",
  ]);
});
