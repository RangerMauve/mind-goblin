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

test("replaces only the first occurrence", async (t) => {
  const f = await makeFile(t, "foo bar foo baz foo");
  const r = ok(await edit({ path: f, old_text: "foo", new_text: "qux" }));
  assert.strictEqual(r.replacements, 1);
  assert.strictEqual(readFileSync(f, "utf8"), "qux bar foo baz foo");
});

test("errors when not found", async (t) => {
  const f = await makeFile(t, "hello world");
  const r = await edit({ path: f, old_text: "absent", new_text: "x" });
  assert.ok("error" in r && /not found/i.test(r.error));
});

test("literal regex metacharacters are not special", async (t) => {
  const f = await makeFile(t, "a.c aXc a.c");
  const r = ok(await edit({ path: f, old_text: "a.c", new_text: "Z" }));
  assert.strictEqual(r.replacements, 1);
  assert.strictEqual(readFileSync(f, "utf8"), "Z aXc a.c");
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
