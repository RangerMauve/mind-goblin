import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAgentsMd } from "../src/utils.js";
import { Goblin } from "../src/index.js";
import { Tools } from "../src/tools.js";

async function makeGoblin(opts = {}) {
  const tools = await Tools.default();
  return new Goblin({ tools, ...opts });
}

test("loadAgentsMd reads AGENTS.md from the given directory", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "agents-md-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, "AGENTS.md"), "# Test Project\nUse pnpm.");

  const content = await loadAgentsMd(dir);
  assert.equal(content, "# Test Project\nUse pnpm.");
});

test("loadAgentsMd falls back to CLAUDE.md when AGENTS.md is absent", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "agents-md-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, "CLAUDE.md"), "# Claude instructions");

  const content = await loadAgentsMd(dir);
  assert.equal(content, "# Claude instructions");
});

test("loadAgentsMd falls back to QWEN.md when AGENTS.md and CLAUDE.md are absent", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "agents-md-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, "QWEN.md"), "# Qwen instructions");

  const content = await loadAgentsMd(dir);
  assert.equal(content, "# Qwen instructions");
});

test("loadAgentsMd prefers AGENTS.md over CLAUDE.md when both exist", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "agents-md-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, "AGENTS.md"), "# Agents");
  await writeFile(join(dir, "CLAUDE.md"), "# Claude");

  const content = await loadAgentsMd(dir);
  assert.equal(content, "# Agents");
});

test("loadAgentsMd returns empty string when no agent files exist", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "agents-md-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const content = await loadAgentsMd(dir);
  assert.equal(content, "");
});

test("loadAgentsMd defaults to cwd", async () => {
  // This repo has an AGENTS.md in the root
  const content = await loadAgentsMd(process.cwd());
  assert.ok(content.length > 0);
  assert.ok(content.includes("mind-goblin"));
});

test("agentsMd: defaults to true", async () => {
  const g = await makeGoblin({});
  assert.equal(g.agentsMd, true);
});

test("agentsMd: can be set to false", async () => {
  const g = await makeGoblin({ agentsMd: false });
  assert.equal(g.agentsMd, false);
});

test("fork: inherits agentsMd from parent", async () => {
  const parent = await makeGoblin({ agentsMd: false });
  const child = parent.fork({});
  assert.equal(child.agentsMd, false);
});

test("fork: inherits agentsMd true from parent", async () => {
  const parent = await makeGoblin({ agentsMd: true });
  const child = parent.fork({});
  assert.equal(child.agentsMd, true);
});

test("fork: agentsMd override on child", async () => {
  const parent = await makeGoblin({ agentsMd: true });
  const child = parent.fork({ agentsMd: false });
  assert.equal(child.agentsMd, false);
});
