import { test } from "node:test";
import { strict as assert } from "node:assert";
import { Commands, CommandDef, DEFAULT_COMPLETE } from "../src/commands.js";

/**
 * Build a Commands instance with a single fake command that records the
 * arguments it is invoked with.
 */
function makeRecordingCommands() {
  const commands = new Commands();
  const calls = [];
  commands.register("!", (line, context, signal) => {
    calls.push({ line, context, signal });
  });
  return { commands, calls };
}

test("Commands.run dispatches to the matching command", async () => {
  const { commands, calls } = makeRecordingCommands();
  const context = {};
  await commands.run("!ls", context);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].line, "ls");
  assert.equal(calls[0].context, context);
});

test("Commands.run forwards the signal to the command", async () => {
  const { commands, calls } = makeRecordingCommands();
  const goblin = { id: "goblin" };
  const context = { goblin };
  const controller = new AbortController();
  await commands.run("!ls", context, controller.signal);
  assert.equal(calls[0].signal, controller.signal);
  assert.equal(calls[0].context.goblin, goblin);
});

test("Commands.run throws when no command matches", async () => {
  const { commands, calls } = makeRecordingCommands();
  await assert.rejects(() => commands.run("ls", {}), /Unknown command: ls/);
  assert.equal(calls.length, 0);
});

test("Commands.run omits signal when not provided", async () => {
  const { commands, calls } = makeRecordingCommands();
  await commands.run("!ls", {});
  assert.equal(calls[0].signal, undefined);
});

test("Commands.has and names reflect registered commands", () => {
  const { commands } = makeRecordingCommands();
  assert.equal(commands.has("!ls"), true);
  assert.equal(commands.has("ls"), false);
  assert.deepEqual(commands.names(), ["!"]);
});

test("Commands.complete delegates to the command's complete", async () => {
  const commands = new Commands();
  commands.register(
    "!",
    () => {},
    () => ["ls", "pwd"],
  );
  const completions = await commands.complete("!", {});
  assert.deepEqual(completions, ["!ls", "!pwd"]);
});

test("Commands.complete returns [] when no command matches", async () => {
  const commands = new Commands();
  commands.register(
    "!",
    () => {},
    () => ["ls"],
  );
  assert.deepEqual(await commands.complete("x", {}), []);
});

test("CommandDef.run forwards args, context, and signal", async () => {
  const calls = [];
  const def = new CommandDef(
    "x",
    (line, context, signal) => calls.push({ line, context, signal }),
    DEFAULT_COMPLETE,
  );
  const context = { goblin: { id: "g" } };
  const controller = new AbortController();
  await def.run("foo", context, controller.signal);
  assert.deepEqual(calls, [
    { line: "foo", context, signal: controller.signal },
  ]);
});

test("CommandDef.complete prefixes completions with the command name", async () => {
  const def = new CommandDef(
    "x",
    () => {},
    () => ["ls", "pwd"],
  );
  assert.deepEqual(await def.complete("", {}), ["xls", "xpwd"]);
});
