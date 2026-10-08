import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import edit from "../src/tools/edit_file.js";
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

test("exact string replaces only the first occurrence by default", async (t) => {
  const f = await makeFile(t, "foo bar foo baz foo");
  const r = ok(await edit({ path: f, old_text: "foo", new_text: "qux" }));
  assert.strictEqual(r.replacements, 1);
  assert.strictEqual(readFileSync(f, "utf8"), "qux bar foo baz foo");
});

test("exact string with all replaces every occurrence", async (t) => {
  const f = await makeFile(t, "foo bar foo baz foo");
  const r = ok(
    await edit({ path: f, old_text: "foo", new_text: "qux", all: true }),
  );
  assert.strictEqual(r.replacements, 3);
  assert.strictEqual(readFileSync(f, "utf8"), "qux bar qux baz qux");
});

test("exact string errors when not found", async (t) => {
  const f = await makeFile(t, "hello world");
  const r = await edit({ path: f, old_text: "absent", new_text: "x" });
  assert.ok("error" in r && /not found/i.test(r.error));
});

test("literal regex metacharacters are not special when regex is false", async (t) => {
  const f = await makeFile(t, "a.c aXc a.c");
  const r = ok(
    await edit({ path: f, old_text: "a.c", new_text: "Z", all: true }),
  );
  assert.strictEqual(r.replacements, 2);
  assert.strictEqual(readFileSync(f, "utf8"), "Z aXc Z");
});

test("regex replaces first match only by default", async (t) => {
  const f = await makeFile(t, "cat cat cat");
  const r = ok(
    await edit({ path: f, old_text: "c.t", new_text: "dog", regex: true }),
  );
  assert.strictEqual(r.replacements, 1);
  assert.strictEqual(readFileSync(f, "utf8"), "dog cat cat");
});

test("regex with all replaces every match", async (t) => {
  const f = await makeFile(t, "cat cat cat");
  const r = ok(
    await edit({
      path: f,
      old_text: "c.t",
      new_text: "dog",
      regex: true,
      all: true,
    }),
  );
  assert.strictEqual(r.replacements, 3);
  assert.strictEqual(readFileSync(f, "utf8"), "dog dog dog");
});

test("word boundary regex avoids partial identifiers", async (t) => {
  const f = await makeFile(t, "oldName oldNameX oldName");
  const r = ok(
    await edit({
      path: f,
      old_text: "\\boldName\\b",
      new_text: "newName",
      regex: true,
      all: true,
    }),
  );
  assert.strictEqual(r.replacements, 2);
  assert.strictEqual(readFileSync(f, "utf8"), "newName oldNameX newName");
});

test("caseInsensitive matches across case", async (t) => {
  const f = await makeFile(t, "true True TRUE");
  const r = ok(
    await edit({
      path: f,
      old_text: "true",
      new_text: "FALSE",
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
    await edit({ path: f, old_text: "true", new_text: "X", all: true }),
  );
  assert.strictEqual(r.replacements, 1);
  assert.strictEqual(readFileSync(f, "utf8"), "X True");
});

test("capture group references in replacement", async (t) => {
  const f = await makeFile(t, "foo(bar)foo(baz)");
  const r = ok(
    await edit({
      path: f,
      old_text: "foo\\(([a-z]*)\\)",
      new_text: "bar($1)",
      regex: true,
      all: true,
    }),
  );
  assert.strictEqual(r.replacements, 2);
  assert.strictEqual(readFileSync(f, "utf8"), "bar(bar)bar(baz)");
});

test("regex ^ and $ match each line", async (t) => {
  const f = await makeFile(t, "# a\nb\n# c\n# d\n");
  const r = ok(
    await edit({
      path: f,
      old_text: "^# ",
      new_text: "",
      regex: true,
      all: true,
    }),
  );
  assert.strictEqual(r.replacements, 3);
  assert.strictEqual(readFileSync(f, "utf8"), "a\nb\nc\nd\n");
});

test("tabs to spaces via regex", async (t) => {
  const f = await makeFile(t, "\ta\tb\tc");
  const r = ok(
    await edit({
      path: f,
      old_text: "\\t",
      new_text: "    ",
      regex: true,
      all: true,
    }),
  );
  assert.strictEqual(r.replacements, 3);
  assert.strictEqual(readFileSync(f, "utf8"), "    a    b    c");
});

test("deleting all occurrences with empty new_text", async (t) => {
  const f = await makeFile(t, "DEBUG: one DEBUG: two DEBUG: three");
  const r = ok(
    await edit({ path: f, old_text: "DEBUG: ", new_text: "", all: true }),
  );
  assert.strictEqual(r.replacements, 3);
  assert.strictEqual(readFileSync(f, "utf8"), "one two three");
});

test("empty old_text is rejected", async (t) => {
  const f = await makeFile(t, "whatever");
  const r = await edit({ path: f, old_text: "", new_text: "x" });
  assert.ok("error" in r && /empty/i.test(r.error));
});

test("errors on a nonexistent file", async (t) => {
  await makeTempDir(t);
  const r = await edit({
    path: "/no/such/file.txt",
    old_text: "a",
    new_text: "b",
  });
  assert.ok("error" in r);
});
