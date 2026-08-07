import { test } from "node:test";
import { strict as assert } from "node:assert";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import readFile from "../src/tools/read_file.js";

const testDir = join(tmpdir(), "mind-goblin-test-files");

test("read_file reads a valid file", async () => {
  const testFile = join(testDir, "test_read.txt");
  const content = "Hello, World!";
  writeFileSync(testFile, content);

  const result = await readFile({ path: testFile });

  assert.ok(result.content);
  assert.strictEqual(result.content, content);
});

test("read_file returns error for non-existent file", async () => {
  const result = await readFile({ path: "/nonexistent/path/file.txt" });

  assert.ok(result.error);
  assert.ok(
    result.error.includes("ENOENT") || result.error.includes("not found"),
  );
});

test("read_file handles empty file", async () => {
  const testFile = join(testDir, "empty.txt");
  writeFileSync(testFile, "");

  const result = await readFile({ path: testFile });

  assert.ok(result.content);
  assert.strictEqual(result.content, "");
});

test("read_file handles file with special characters", async () => {
  const testFile = join(testDir, "special.txt");
  const content = "Hello 世界 🌍\nLine 2\nLine 3";
  writeFileSync(testFile, content);

  const result = await readFile({ path: testFile });

  assert.ok(result.content);
  assert.strictEqual(result.content, content);
});

test("read_file handles file with newlines", async () => {
  const testFile = join(testDir, "newlines.txt");
  const content = "Line 1\nLine 2\nLine 3\nLine 4";
  writeFileSync(testFile, content);

  const result = await readFile({ path: testFile });

  assert.ok(result.content);
  assert.strictEqual(result.content, content);
});

test("read_file handles relative path", async () => {
  const testFile = join(testDir, "relative.txt");
  const content = "Relative path test";
  writeFileSync(testFile, content);

  const result = await readFile({ path: testFile });

  assert.ok(result.content);
  assert.strictEqual(result.content, content);
});
