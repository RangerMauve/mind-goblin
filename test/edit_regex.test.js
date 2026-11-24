import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import edit from "../src/tools/edit_regex.js";
import { makeTempDir } from "./helpers.js";

/** @typedef {Awaited<ReturnType<typeof edit>>} EditResult */

/**
 * Create a temp file with the given contents and return its path.
 * @param {import("node:test").TestContext} t
 * @param {string} contents
 * @param {string} [name]
 * @returns {Promise<string>}
 */
async function makeFile(t, contents, name = "edit.txt") {
  const dir = await makeTempDir(t);
  const file = join(dir, name);
  writeFileSync(file, contents);
  return file;
}

/**
 * Assert that an edit result succeeded and narrow its type.
 * @param {EditResult} r
 * @returns {Extract<EditResult, {success: true}>}
 */
function ok(r) {
  if ("error" in r) {
    throw new Error(`expected success, got error: ${r.error}`);
  }
  return r;
}

test("replaces first match only by default", async (t) => {
  const f = await makeFile(t, "cat cat cat");
  const r = ok(await edit({ path: f, pattern: "c.t", replacement: "dog" }));
  assert.strictEqual(r.replacements, 1);
  assert.strictEqual(readFileSync(f, "utf8"), "dog cat cat");
});

test("all replaces every match", async (t) => {
  const f = await makeFile(t, "cat cat cat");
  const r = ok(
    await edit({ path: f, pattern: "c.t", replacement: "dog", all: true }),
  );
  assert.strictEqual(r.replacements, 3);
  assert.strictEqual(readFileSync(f, "utf8"), "dog dog dog");
});

test("word boundary regex avoids partial identifiers", async (t) => {
  const f = await makeFile(t, "oldName oldNameX oldName");
  const r = ok(
    await edit({
      path: f,
      pattern: "\\boldName\\b",
      replacement: "newName",
      all: true,
    }),
  );
  assert.strictEqual(r.replacements, 2);
  assert.strictEqual(readFileSync(f, "utf8"), "newName oldNameX newName");
});

test("capture group references in replacement", async (t) => {
  const f = await makeFile(t, "foo(bar)foo(baz)");
  const r = ok(
    await edit({
      path: f,
      pattern: "foo\\(([a-z]*)\\)",
      replacement: "bar($1)",
      all: true,
    }),
  );
  assert.strictEqual(r.replacements, 2);
  assert.strictEqual(readFileSync(f, "utf8"), "bar(bar)bar(baz)");
});

test("^ and $ match each line", async (t) => {
  const f = await makeFile(t, "# a\nb\n# c\n# d\n");
  const r = ok(
    await edit({ path: f, pattern: "^# ", replacement: "", all: true }),
  );
  assert.strictEqual(r.replacements, 3);
  assert.strictEqual(readFileSync(f, "utf8"), "a\nb\nc\nd\n");
});

test("tabs to spaces", async (t) => {
  const f = await makeFile(t, "\ta\tb\tc");
  const r = ok(
    await edit({ path: f, pattern: "\\t", replacement: "    ", all: true }),
  );
  assert.strictEqual(r.replacements, 3);
  assert.strictEqual(readFileSync(f, "utf8"), "    a    b    c");
});

test("caseInsensitive matches across case", async (t) => {
  const f = await makeFile(t, "true True TRUE");
  const r = ok(
    await edit({
      path: f,
      pattern: "true",
      replacement: "FALSE",
      all: true,
      caseInsensitive: true,
    }),
  );
  assert.strictEqual(r.replacements, 3);
  assert.strictEqual(readFileSync(f, "utf8"), "FALSE FALSE FALSE");
});

test("case-sensitive by default leaves other case untouched", async (t) => {
  const f = await makeFile(t, "true True");
  const r = ok(
    await edit({ path: f, pattern: "true", replacement: "X", all: true }),
  );
  assert.strictEqual(r.replacements, 1);
  assert.strictEqual(readFileSync(f, "utf8"), "X True");
});

test("empty pattern is rejected", async (t) => {
  const f = await makeFile(t, "whatever");
  const r = await edit({ path: f, pattern: "", replacement: "x" });
  assert.ok("error" in r && /empty/i.test(r.error));
});

test("invalid regex returns error", async (t) => {
  const f = await makeFile(t, "whatever");
  const r = await edit({ path: f, pattern: "([unclosed", replacement: "x" });
  assert.ok("error" in r && /invalid regex/i.test(r.error));
});

test("pattern not found returns error", async (t) => {
  const f = await makeFile(t, "hello world");
  const r = await edit({ path: f, pattern: "absent", replacement: "x" });
  assert.ok("error" in r && /not found/i.test(r.error));
});

test("errors on a nonexistent file", async (t) => {
  await makeTempDir(t);
  const r = await edit({
    path: "/no/such/file.txt",
    pattern: "a",
    replacement: "b",
  });
  assert.ok("error" in r);
});
