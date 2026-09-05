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
  /** @type {Array<{line: string, context: import("../src/repl.js").REPLContext, commands: Commands, signal?: AbortSignal}>} */
  const calls = [];
  commands.register("!", (line, context, commands, signal) => {
    calls.push({ line, context, commands, signal });
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
    assert.equal(calls[0].commands, commands);
  });
});

test("Commands.run forwards the signal to the command", (t) => {
  const { commands, calls } = makeRecordingCommands();
  const context = makeContext(t);
  const controller = new AbortController();
  return commands.run("!ls", context, controller.signal).then(() => {
    assert.equal(calls[0].signal, controller.signal);
    assert.equal(calls[0].commands, commands);
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

test("Commands.descriptions returns name-to-description map", () => {
  const commands = new Commands();
  commands.register("!", () => {}, DEFAULT_COMPLETE, "Run a shell command");
  commands.register("/clear", () => {}, DEFAULT_COMPLETE, "Clear history");
  assert.deepEqual(
    commands.descriptions(),
    new Map([
      ["!", "Run a shell command"],
      ["/clear", "Clear history"],
    ]),
  );
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

test("CommandDef.run forwards args, context, commands, and signal", async (t) => {
  /** @type {Array<{line: string, context: import("../src/repl.js").REPLContext, commands: Commands, signal?: AbortSignal}>} */
  const calls = [];
  const fakeCommands = new Commands();
  const def = new CommandDef(
    "x",
    (line, context, commands, signal) => {
      calls.push({ line, context, commands, signal });
    },
    DEFAULT_COMPLETE,
  );
  const context = makeContext(t);
  const controller = new AbortController();
  await def.run("foo", context, fakeCommands, controller.signal);
  assert.deepEqual(calls, [
    { line: "foo", context, commands: fakeCommands, signal: controller.signal },
  ]);
});

test("CommandDef.description getter returns the description", () => {
  const def = new CommandDef("x", () => {}, DEFAULT_COMPLETE, "A test command");
  assert.equal(def.description, "A test command");
});

test("CommandDef.complete is a passthrough", async (t) => {
  const def = new CommandDef(
    "x",
    () => {},
    () => ["ls", "pwd"],
  );
  const context = makeContext(t);
  const fakeCommands = new Commands();
  assert.deepEqual(await def.complete("", context, fakeCommands), [
    "ls",
    "pwd",
  ]);
});

test("Commands.complete inserts space for multi-char commands", async (t) => {
  const commands = new Commands();
  commands.register(
    "/foo",
    () => {},
    () => ["ls", "pwd"],
  );
  const context = makeContext(t);
  assert.deepEqual(await commands.complete("/foo", context), [
    "/foo ls",
    "/foo pwd",
  ]);
});

test("Commands.complete strips user-typed space before delegating", async (t) => {
  const commands = new Commands();
  commands.register(
    "/foo",
    () => {},
    () => ["ls", "pwd"],
  );
  const context = makeContext(t);
  assert.deepEqual(await commands.complete("/foo ", context), [
    "/foo ls",
    "/foo pwd",
  ]);
});

test("Commands.complete passes args without leading space to command", async (t) => {
  /** @type {string[]} */
  const received = [];
  const commands = new Commands();
  commands.register(
    "/foo",
    () => {},
    (args) => {
      received.push(args);
      return ["bar"];
    },
  );
  const context = makeContext(t);
  await commands.complete("/foo b", context);
  assert.deepEqual(received, ["b"]);
});
