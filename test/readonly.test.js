import { test } from "node:test";
import { strict as assert } from "node:assert";
import { Goblin } from "../src/index.js";
import { Tools } from "../src/tools.js";
import shellCommand from "../src/tools/shell_command.js";
import { check } from "../src/tools/shell_command.js";

/**
 * Build a Goblin with the standard tool set.
 * @param {object} opts
 */
async function makeGoblin(opts = {}) {
  const tools = await Tools.default();
  return new Goblin({ tools, ...opts });
}

test("Tools.readonly() returns a new Tools with only readonly-safe tools", async () => {
  const tools = await Tools.default();
  const ro = tools.readonly();
  assert.ok(!ro.names.includes("write_file"));
  assert.ok(!ro.names.includes("edit_file"));
  assert.ok(ro.names.includes("read"));
  assert.ok(ro.names.includes("shell_command"));
  assert.ok(ro.names.includes("get_current_time"));
});

test("Tools.readonly() returns a subset of the original", async () => {
  const tools = await Tools.default();
  const ro = tools.readonly();
  assert.ok(ro.length < tools.length);
  for (const name of ro.names) {
    assert.ok(tools.names.includes(name));
  }
});

test("Tools.readonly() on empty Tools returns empty Tools", () => {
  const tools = new Tools();
  const ro = tools.readonly();
  assert.equal(ro.length, 0);
});

test("readonly: false keeps write_file and edit_file", async () => {
  const g = await makeGoblin({ readonly: false });
  assert.ok(g.tools.names.includes("write_file"));
  assert.ok(g.tools.names.includes("edit_file"));
  assert.equal(g.readonly, false);
});

test("readonly: true strips write_file and edit_file", async () => {
  const g = await makeGoblin({ readonly: true });
  assert.ok(!g.tools.names.includes("write_file"));
  assert.ok(!g.tools.names.includes("edit_file"));
  // Other tools should still be present
  assert.ok(g.tools.names.includes("shell_command"));
  assert.ok(g.tools.names.includes("read"));
  assert.equal(g.readonly, true);
});

test("readonly: defaults to false", async () => {
  const g = await makeGoblin({});
  assert.equal(g.readonly, false);
  assert.ok(g.tools.names.includes("write_file"));
});

test("fork: inherits readonly from parent", async () => {
  const parent = await makeGoblin({ readonly: true });
  const child = parent.fork({});
  assert.equal(child.readonly, true);
  assert.ok(!child.tools.names.includes("write_file"));
  assert.ok(!child.tools.names.includes("edit_file"));
});

test("fork: inherits non-readonly from parent", async () => {
  const parent = await makeGoblin({ readonly: false });
  const child = parent.fork({});
  assert.equal(child.readonly, false);
  assert.ok(child.tools.names.includes("write_file"));
});

test("fork: readonly override true on non-readonly parent", async () => {
  const parent = await makeGoblin({ readonly: false });
  const child = parent.fork({ readonly: true });
  assert.equal(child.readonly, true);
  assert.ok(!child.tools.names.includes("write_file"));
});

test("fork: readonly override false on readonly parent still lacks stripped tools", async () => {
  const parent = await makeGoblin({ readonly: true });
  const child = parent.fork({ readonly: false });
  assert.equal(child.readonly, false);
  // Tools stripped at parent construction time cannot be restored by fork
  assert.ok(!child.tools.names.includes("write_file"));
});

test("shell_command: readonly agent rejects non-allowlisted command", async () => {
  const g = await makeGoblin({ readonly: true });
  // `rm` is not on the allowlist
  assert.ok(check("rm -rf /"));

  await assert.rejects(
    () => shellCommand({ command: "rm -rf /" }, g),
    /Rejected: read-only/,
  );
});

test("shell_command: readonly agent allows allowlisted command", async () => {
  const g = await makeGoblin({ readonly: true });
  // `ls` is on the allowlist
  assert.ok(!check("ls"));

  const result = await shellCommand({ command: "ls" }, g);
  assert.equal(typeof result.stdout, "string");
});

test("shell_command: non-readonly agent runs any command", async () => {
  const g = await makeGoblin({ readonly: false });
  // `echo` with a pipe would normally be flagged, but non-readonly skips the check
  const result = await shellCommand({ command: "echo hello" }, g);
  assert.equal(result.stdout.trim(), "hello");
});

test("shell_command: undefined agent does not reject", async () => {
  // Simulates the case where no agent is passed (e.g. direct tool call)
  const result = await shellCommand({ command: "echo hi" }, undefined);
  assert.equal(result.stdout.trim(), "hi");
});
