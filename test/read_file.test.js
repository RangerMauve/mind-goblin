import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import read from "../src/tools/read.js";

const testDir = join(tmpdir(), "mind-goblin-test-files");
mkdirSync(testDir, { recursive: true });

/** @typedef {Awaited<ReturnType<typeof read>>} ReadResult */

/**
 * @param {ReadResult} r
 * @returns {string}
 */
function fileContent(r) {
  assert.ok("content" in r, "expected file result, got directory listing");
  return r.content;
}

/**
 * @param {ReadResult} r
 * @returns {string[]}
 */
function dirContents(r) {
  assert.ok("contents" in r, "expected directory result, got file content");
  return r.contents;
}

test("read reads a valid file", async () => {
  const testFile = join(testDir, "test_read.txt");
  const content = "Hello, World!";
  writeFileSync(testFile, content);

  const result = await read({ path: testFile });
  assert.ok(fileContent(result));
  assert.strictEqual(fileContent(result), content);
});

test("read rejects for non-existent file", async () => {
  await assert.rejects(read({ path: "/nonexistent/path/file.txt" }));
});

test("read handles empty file", async () => {
  const testFile = join(testDir, "empty.txt");
  writeFileSync(testFile, "");

  const result = await read({ path: testFile });
  assert.ok("content" in result);
  assert.strictEqual(fileContent(result), "");
});

test("read handles file with special characters", async () => {
  const testFile = join(testDir, "special.txt");
  const content = "Hello 世界 🌍\nLine 2\nLine 3";
  writeFileSync(testFile, content);

  const result = await read({ path: testFile });
  assert.ok(fileContent(result));
  assert.strictEqual(fileContent(result), content);
});

test("read handles file with newlines", async () => {
  const testFile = join(testDir, "newlines.txt");
  const content = "Line 1\nLine 2\nLine 3\nLine 4";
  writeFileSync(testFile, content);

  const result = await read({ path: testFile });
  assert.ok(fileContent(result));
  assert.strictEqual(fileContent(result), content);
});

test("read handles relative path", async () => {
  const testFile = join(testDir, "relative.txt");
  const content = "Relative path test";
  writeFileSync(testFile, content);

  const result = await read({ path: testFile });
  assert.ok(fileContent(result));
  assert.strictEqual(fileContent(result), content);
});

test("read lists a directory", async () => {
  const dir = join(testDir, "read-dir");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "a.txt"), "a");
  writeFileSync(join(dir, "b.txt"), "b");

  const result = await read({ path: dir });
  const contents = dirContents(result);
  assert.ok(Array.isArray(contents));
  assert.ok(!("content" in result));
  assert.deepEqual(contents.sort(), ["a.txt", "b.txt"]);
});

test("read lists an empty directory", async () => {
  const dir = join(testDir, "read-empty-dir");
  mkdirSync(dir, { recursive: true });

  const result = await read({ path: dir });
  assert.ok(Array.isArray(dirContents(result)));
  assert.deepEqual(dirContents(result), []);
});

test("read rejects for directory that does not exist", async () => {
  await assert.rejects(read({ path: join(testDir, "no-such-dir") }));
});
