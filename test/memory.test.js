import { test } from "node:test";
import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadMemory, memoryFile } from "../src/utils.js";
import { makeGoblin, makeTempDir } from "./helpers.js";

test("loadMemory reads existing file", async (t) => {
  const dir = await makeTempDir(t);
  const file = join(dir, "MEMORY.md");
  await writeFile(file, "- remember the milk\n- use pnpm\n");

  const content = await loadMemory(file);
  assert.equal(content, "- remember the milk\n- use pnpm\n");
});

test("loadMemory returns empty string for missing file", async () => {
  const content = await loadMemory("/nonexistent/MEMORY.md");
  assert.equal(content, "");
});

test("memoryFile constant points to data dir", () => {
  assert.ok(memoryFile.endsWith("MEMORY.md"));
});

test("memoryFile: defaults to null", async () => {
  const g = await makeGoblin({});
  assert.equal(g.memoryFile, null);
});

test("memoryFile: can be set", async () => {
  const g = await makeGoblin({ memoryFile: "/tmp/my-mem.md" });
  assert.equal(g.memoryFile, "/tmp/my-mem.md");
});

test("fork: inherits memoryFile from parent", async () => {
  const parent = await makeGoblin({ memoryFile: "/tmp/parent.md" });
  const child = parent.fork({});
  assert.equal(child.memoryFile, "/tmp/parent.md");
});

test("fork: inherits null memoryFile from parent", async () => {
  const parent = await makeGoblin({});
  const child = parent.fork({});
  assert.equal(child.memoryFile, null);
});

test("fork: memoryFile override on child", async () => {
  const parent = await makeGoblin({ memoryFile: "/tmp/parent.md" });
  const child = parent.fork({ memoryFile: "/tmp/child.md" });
  assert.equal(child.memoryFile, "/tmp/child.md");
});
