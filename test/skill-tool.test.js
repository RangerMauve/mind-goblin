import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Skills } from "../src/skills.js";
import { Tools } from "../src/tools.js";
import { Context } from "../src/context.js";
import { makeGoblin } from "./helpers.js";
import skillTool from "../src/tools/skill.js";
import unskillTool from "../src/tools/unskill.js";

const SKILLS_DIR = path.join(
  os.tmpdir(),
  `mind-goblin-skill-tool-${Date.now()}`,
);

const ALPHA = `---
name: alpha
description: Does alpha things.
---
Alpha instructions.
`;

before(async () => {
  const dir = path.join(SKILLS_DIR, "alpha");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "SKILL.md"), ALPHA);
});

after(() => fs.rm(SKILLS_DIR, { recursive: true, force: true }));

/**
 * Build a Goblin with a discovered Skills index and a plain Context.
 * @returns {Promise<Context>}
 */
async function makeSkillContext() {
  const skills = new Skills([SKILLS_DIR]);
  await skills.discover();
  const goblin = await makeGoblin({ skills, agentsMd: false });
  return new Context(goblin, null);
}

test("Tools.default() registers skill and unskill, readonly-safe", async () => {
  const tools = await Tools.default();
  assert.ok(tools.names.includes("skill"));
  assert.ok(tools.names.includes("unskill"));
  const ro = tools.readonly();
  assert.ok(ro.names.includes("skill"));
  assert.ok(ro.names.includes("unskill"));
});

test("skill tool loads a skill into the context messages", async () => {
  const ctx = await makeSkillContext();
  const result = await skillTool({ name: "alpha" }, ctx);
  assert.deepEqual(result, { loaded: "alpha" });
  assert.equal(ctx.messages.length, 2);
  assert.equal(ctx.messages[0].role, "assistant");
  assert.equal(ctx.messages[1].role, "tool");
  const toolMsg = ctx.messages[1];
  if (toolMsg.role !== "tool") throw new Error("expected tool message");
  assert.ok(toolMsg.content.includes("Alpha instructions."));
  assert.ok(ctx.goblin.skills?.findActive(ctx.messages).has("alpha"));
});

test("skill tool dedupes an already active skill", async () => {
  const ctx = await makeSkillContext();
  await skillTool({ name: "alpha" }, ctx);
  const result = await skillTool({ name: "alpha" }, ctx);
  if (!("active" in result)) throw new Error("expected an active result");
  assert.equal(result.active, true);
  assert.equal(ctx.messages.length, 2);
});

test("skill tool errors on unknown skill", async () => {
  const ctx = await makeSkillContext();
  const result = await skillTool({ name: "nope" }, ctx);
  if (!("error" in result)) throw new Error("expected an error result");
  assert.match(result.error, /Unknown skill: nope/);
  assert.equal(ctx.messages.length, 0);
});

test("unskill tool removes a loaded skill", async () => {
  const ctx = await makeSkillContext();
  await skillTool({ name: "alpha" }, ctx);
  assert.equal(ctx.messages.length, 2);
  const result = await unskillTool({ name: "alpha" }, ctx);
  assert.deepEqual(result, { unloaded: "alpha" });
  assert.equal(ctx.messages.length, 0);
});

test("unskill tool distinguishes unknown from not loaded", async () => {
  const ctx = await makeSkillContext();
  const unknown = await unskillTool({ name: "nope" }, ctx);
  if (!("error" in unknown)) throw new Error("expected an error result");
  assert.match(unknown.error, /Unknown skill: nope/);
  const notLoaded = await unskillTool({ name: "alpha" }, ctx);
  if (!("error" in notLoaded)) throw new Error("expected an error result");
  assert.match(notLoaded.error, /not currently loaded/);
});

test("skill and unskill tools error cleanly without skills", async () => {
  const goblin = await makeGoblin({ agentsMd: false });
  const ctx = new Context(goblin, null);
  const skillResult = await skillTool({ name: "alpha" }, ctx);
  if (!("error" in skillResult)) throw new Error("expected an error result");
  assert.match(skillResult.error, /not available/);
  const unskillResult = await unskillTool({ name: "alpha" }, ctx);
  if (!("error" in unskillResult)) throw new Error("expected an error result");
  assert.match(unskillResult.error, /not available/);
});

test("makeSystemPrompt lists skill names and descriptions without paths", async () => {
  const ctx = await makeSkillContext();
  const prompt = await ctx.goblin.makeSystemPrompt();
  assert.ok(prompt.includes("## Available Skills"));
  assert.ok(prompt.includes("- alpha — Does alpha things."));
  assert.ok(!prompt.includes(SKILLS_DIR));
});

test("makeSystemPrompt has no skills section when skills are empty or null", async () => {
  const empty = new Skills([]);
  await empty.discover();
  const g1 = await makeGoblin({ skills: empty, agentsMd: false });
  assert.ok(!(await g1.makeSystemPrompt()).includes("## Available Skills"));
  const g2 = await makeGoblin({ agentsMd: false });
  assert.ok(!(await g2.makeSystemPrompt()).includes("## Available Skills"));
});

test("makeSystemPrompt puts skills before memory", async () => {
  const ctx = await makeSkillContext();
  const memoryFile = path.join(SKILLS_DIR, "MEMORY.md");
  await fs.writeFile(memoryFile, "- a memory\n");
  ctx.goblin.memoryFile = memoryFile;
  const prompt = await ctx.goblin.makeSystemPrompt();
  const skillsIdx = prompt.indexOf("## Available Skills");
  const memoryIdx = prompt.indexOf("## Memory");
  assert.ok(skillsIdx !== -1 && memoryIdx !== -1);
  assert.ok(skillsIdx < memoryIdx);
});
