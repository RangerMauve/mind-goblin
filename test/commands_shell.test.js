import { test } from "node:test";
import { strict as assert } from "node:assert";
import { Commands } from "../src/commands.js";
import { USER, ASSISTANT, TOOL } from "../src/index.js";

/** @typedef {import("../src/repl.js").REPLContext} REPLContext */

/**
 * Build a minimal fake context that records pushed messages. The goblin
 * (agent) is exposed on the context, matching the real REPLContext.
 * @param {object} [goblin]
 */
function makeFakeContext(goblin) {
  const pushed = [];
  return {
    goblin,
    pushed,
    /** @param {object[]} msgs */
    push(...msgs) {
      pushed.push(...msgs);
    },
  };
}

/**
 * Build a Commands instance with the real shell command loaded.
 */
async function makeShellCommands() {
  const commands = new Commands();
  await commands.load("shell");
  return commands;
}

/**
 * A stub agent satisfying the type that shellCommand expects.
 */
function makeStubAgent() {
  return { id: "test-agent" };
}

test("shell command: run executes a command and records messages", async () => {
  const commands = await makeShellCommands();
  const context = makeFakeContext(makeStubAgent());

  await commands.run("!echo hello", context);

  assert.equal(context.pushed.length, 3);
  assert.deepEqual(context.pushed[0], {
    role: USER,
    content: "!echo hello",
  });

  const assistantMsg = context.pushed[1];
  assert.equal(assistantMsg.role, ASSISTANT);
  assert.equal(assistantMsg.tool_calls[0].function.name, "shell_command");
  assert.equal(
    JSON.parse(assistantMsg.tool_calls[0].function.arguments).command,
    "echo hello",
  );

  const toolMsg = context.pushed[2];
  assert.equal(toolMsg.role, TOOL);
  assert.match(toolMsg.content, /hello/);
});

test("shell command: run forwards goblin and signal", async () => {
  const commands = await makeShellCommands();
  const context = makeFakeContext(makeStubAgent());
  const controller = new AbortController();

  await commands.run("!echo test", context, controller.signal);

  // If it got here without throwing, the agent and signal were accepted.
  assert.equal(context.pushed.length, 3);
});

test("shell command: run handles stderr output", async () => {
  const commands = await makeShellCommands();
  const context = makeFakeContext(makeStubAgent());

  await commands.run("!echo oops 2>&1", context);

  assert.equal(context.pushed.length, 3);
  assert.match(context.pushed[2].content, /oops/);
});

test("shell command: run with no output records placeholder", async () => {
  const commands = await makeShellCommands();
  const context = makeFakeContext(makeStubAgent());

  await commands.run("!:", context);

  assert.equal(context.pushed.length, 3);
  assert.equal(context.pushed[2].content, "(no output)");
});

test("shell command: tool_call_id is consistent across messages", async () => {
  const commands = await makeShellCommands();
  const context = makeFakeContext(makeStubAgent());

  await commands.run("!true", context);

  const assistantMsg = context.pushed[1];
  const toolMsg = context.pushed[2];
  assert.equal(assistantMsg.tool_calls[0].id, toolMsg.tool_call_id);
});

test("Commands.run throws for unknown command", async () => {
  const commands = await makeShellCommands();
  const context = makeFakeContext(makeStubAgent());

  await assert.rejects(() => commands.run("ls", context), /Unknown command/);
});

test("shell command: complete returns suggestions", async () => {
  const commands = await makeShellCommands();
  const completions = await commands.complete("!", {});

  // Basic commands should be present
  assert.ok(completions.some((c) => c.startsWith("!")));
});
