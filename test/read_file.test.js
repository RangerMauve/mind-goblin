import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import read from "../src/tools/read.js";

const testDir = join(tmpdir(), "mind-goblin-test-files");
mkdirSync(testDir, { recursive: true });

test("read reads a valid file", async () => {
  const testFile = join(testDir, "test_read.txt");
  const content = "Hello, World!";
  writeFileSync(testFile, content);

  const result = await read({ path: testFile });

  assert.ok(result.content);
  assert.strictEqual(result.content, content);
});

test("read rejects for non-existent file", async () => {
  await assert.rejects(read({ path: "/nonexistent/path/file.txt" }));
});

test("read handles empty file", async () => {
  const testFile = join(testDir, "empty.txt");
  writeFileSync(testFile, "");

  const result = await read({ path: testFile });

  assert.ok("content" in result);
  assert.strictEqual(result.content, "");
});

test("read handles file with special characters", async () => {
  const testFile = join(testDir, "special.txt");
  const content = "Hello 世界 🌍\nLine 2\nLine 3";
  writeFileSync(testFile, content);

  const result = await read({ path: testFile });

  assert.ok(result.content);
  assert.strictEqual(result.content, content);
});

test("read handles file with newlines", async () => {
  const testFile = join(testDir, "newlines.txt");
  const content = "Line 1\nLine 2\nLine 3\nLine 4";
  writeFileSync(testFile, content);

  const result = await read({ path: testFile });

  assert.ok(result.content);
  assert.strictEqual(result.content, content);
});

test("read handles relative path", async () => {
  const testFile = join(testDir, "relative.txt");
  const content = "Relative path test";
  writeFileSync(testFile, content);

  const result = await read({ path: testFile });

  assert.ok(result.content);
  assert.strictEqual(result.content, content);
});

test("read lists a directory", async () => {
  const dir = join(testDir, "read-dir");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "a.txt"), "a");
  writeFileSync(join(dir, "b.txt"), "b");

  const result = await read({ path: dir });

  assert.ok(Array.isArray(result.contents));
  assert.ok(!("content" in result));
  assert.deepEqual(result.contents.sort(), ["a.txt", "b.txt"]);
});

test("read lists an empty directory", async () => {
  const dir = join(testDir, "read-empty-dir");
  mkdirSync(dir, { recursive: true });

  const result = await read({ path: dir });

  assert.ok(Array.isArray(result.contents));
  assert.deepEqual(result.contents, []);
});

test("read rejects for directory that does not exist", async () => {
  await assert.rejects(read({ path: join(testDir, "no-such-dir") }));
});
