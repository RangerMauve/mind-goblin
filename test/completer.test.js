import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { makeCommands } from "./helpers.js";
import { makeCompleter } from "../src/completer.js";

/** @import { REPLContext } from "../src/repl.js" */

/**
 * Create a completer with a stub context (only used for command completion,
 * which we don't test here).
 * @returns {Promise<(line: string) => Promise<[string[], string]>>}
 */
async function makeTestCompleter() {
  const commands = await makeCommands();
  /** @type {REPLContext} */
  const context = /** @type {any} */ ({
    goblin: {},
    logger: { info() {}, error() {}, assistant() {} },
    messages: [],
    history: [],
    sessionName: "test",
    async sessions() {
      return [];
    },
  });
  return makeCompleter(commands, context);
}

/**
 * Chdir into a temp dir, register cleanup.
 * @param {import("node:test").TestContext} t
 * @returns {Promise<string>}
 */
async function chdirTemp(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "completer-test-"));
  const origCwd = process.cwd();
  process.chdir(dir);
  t.after(() => {
    process.chdir(origCwd);
    return rm(dir, { recursive: true, force: true });
  });
  return dir;
}

test("completes absolute paths", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "completer-absolute-"));
  await writeFile(path.join(dir, "alpha.txt"), "");
  t.after(() => rm(dir, { recursive: true, force: true }));

  const completer = await makeTestCompleter();
  const prefix = path.join(dir, "al");
  const [matches, line] = await completer(prefix);
  assert.ok(
    matches.includes(path.join(dir, "alpha.txt")),
    `expected alpha.txt, got ${JSON.stringify(matches)}`,
  );
  assert.equal(line, prefix);
});

test("completes paths starting with ./", async (t) => {
  const dir = await chdirTemp(t);
  await writeFile(path.join(dir, "foo.js"), "");
  await writeFile(path.join(dir, "bar.js"), "");

  const completer = await makeTestCompleter();
  const [matches, line] = await completer("./fo");
  assert.deepEqual(matches, ["./foo.js"]);
  assert.equal(line, "./fo");
});

test("returns empty for bare words", async () => {
  const completer = await makeTestCompleter();
  const [matches] = await completer("hello");
  assert.deepEqual(matches, []);
});

test("completes paths starting with ~", async () => {
  const home = os.homedir();
  const entries = await readdir(home, { withFileTypes: true });
  assert.ok(entries.length > 0, "home dir should not be empty");

  const completer = await makeTestCompleter();

  // Completing just ~ should list home directory entries
  const [matches] = await completer("~");
  assert.ok(matches.length > 0, "should return matches for ~");
  for (const m of matches) {
    assert.ok(m.startsWith("~/"), `expected ~/-prefixed match, got ${m}`);
  }

  // Completing ~/ with a prefix should filter
  const someEntry = entries[0].name;
  const prefix = someEntry.slice(0, 1);
  const [filtered] = await completer(`~/${prefix}`);
  assert.ok(filtered.length > 0, "should have filtered matches");
  for (const m of filtered) {
    assert.ok(
      m.startsWith(`~/${prefix}`),
      `expected ~/${prefix} prefix, got ${m}`,
    );
  }
});
