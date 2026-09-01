import { test } from "node:test";
import { strict as assert } from "node:assert";
import { Commands, CommandDef, DEFAULT_COMPLETE } from "../src/commands.js";
import { makeContext } from "./helpers.js";

/**
 * Build a Commands instance with a single fake command that records the
 * arguments it is invoked with.
 */
function makeRecordingCommands() {
  const commands = new Commands();
  /** @type {Array<{line: string, context: import("../src/repl.js").REPLContext, signal?: AbortSignal}>} */
  const calls = [];
  commands.register("!", (line, context, signal) => {
    calls.push({ line, context, signal });
  });
  return { commands, calls };
}

test("Commands.run dispatches to the matching command", (t) => {
  const { commands, calls } = makeRecordingCommands();
  const context = makeContext(t);
  return commands.run("!ls", context).then(() => {
    assert.equal(calls.length, 1);
    assert.equal(calls[0].line, "ls");
    assert.equal(calls[0].context, context);
  });
});

test("Commands.run forwards the signal to the command", (t) => {
  const { commands, calls } = makeRecordingCommands();
  const context = makeContext(t);
  const controller = new AbortController();
  return commands.run("!ls", context, controller.signal).then(() => {
    assert.equal(calls[0].signal, controller.signal);
    assert.equal(calls[0].context.goblin, context.goblin);
  });
});

test("Commands.run throws when no command matches", (t) => {
  const { commands, calls } = makeRecordingCommands();
  const context = makeContext(t);
  return assert
    .rejects(() => commands.run("ls", context), /Unknown command: ls/)
    .then(() => {
      assert.equal(calls.length, 0);
    });
});

test("Commands.run omits signal when not provided", (t) => {
  const { commands, calls } = makeRecordingCommands();
  const context = makeContext(t);
  return commands.run("!ls", context).then(() => {
    assert.equal(calls[0].signal, undefined);
  });
});

test("Commands.has and names reflect registered commands", () => {
  const commands = new Commands();
  commands.register("!", () => {});
  assert.equal(commands.has("!ls"), true);
  assert.equal(commands.has("ls"), false);
  assert.deepEqual(commands.names(), ["!"]);
});

test("Commands.complete delegates to the command's complete", async (t) => {
  const commands = new Commands();
  commands.register(
    "!",
    () => {},
    () => ["ls", "pwd"],
  );
  const context = makeContext(t);
  const completions = await commands.complete("!", context);
  assert.deepEqual(completions, ["!ls", "!pwd"]);
});

test("Commands.complete returns [] when no command matches", async (t) => {
  const commands = new Commands();
  commands.register(
    "!",
    () => {},
    () => ["ls"],
  );
  const context = makeContext(t);
  assert.deepEqual(await commands.complete("x", context), []);
});

test("CommandDef.run forwards args, context, and signal", async (t) => {
  /** @type {Array<{line: string, context: import("../src/repl.js").REPLContext, signal?: AbortSignal}>} */
  const calls = [];
  const def = new CommandDef(
    "x",
    (line, context, signal) => {
      calls.push({ line, context, signal });
    },
    DEFAULT_COMPLETE,
  );
  const context = makeContext(t);
  const controller = new AbortController();
  await def.run("foo", context, controller.signal);
  assert.deepEqual(calls, [
    { line: "foo", context, signal: controller.signal },
  ]);
});

test("CommandDef.complete prefixes completions with the command name", async (t) => {
  const def = new CommandDef(
    "x",
    () => {},
    () => ["ls", "pwd"],
  );
  const context = makeContext(t);
  assert.deepEqual(await def.complete("", context), ["xls", "xpwd"]);
});
