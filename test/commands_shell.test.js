import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ASSISTANT, TOOL, USER } from "../src/index.js";
import { makeCommands, makeContext } from "./helpers.js";

/** @import {AssistantMessage, ToolMessage} from "../src/index.js" */

test("shell command: run executes a command and records messages", async (t) => {
  const commands = await makeCommands("shell");
  const context = makeContext(t);

  await commands.run("!echo hello", context);

  const msgs = context.messages;
  assert.equal(msgs.length, 3);
  assert.deepEqual(msgs[0], {
    role: USER,
    content: "!echo hello",
  });

  const assistantMsg = /** @type {AssistantMessage} */ (msgs[1]);
  assert.equal(assistantMsg.role, ASSISTANT);
  assert.ok(assistantMsg.tool_calls);
  assert.equal(assistantMsg.tool_calls[0].function.name, "shell_command");
  assert.equal(
    JSON.parse(assistantMsg.tool_calls[0].function.arguments).command,
    "echo hello",
  );

  const toolMsg = /** @type {ToolMessage} */ (msgs[2]);
  assert.equal(toolMsg.role, TOOL);
  assert.match(toolMsg.content, /hello/);
});

test("shell command: run forwards goblin and signal", async (t) => {
  const commands = await makeCommands("shell");
  const context = makeContext(t);
  const controller = new AbortController();

  await commands.run("!echo test", context, controller.signal);

  assert.equal(context.messages.length, 3);
});

test("shell command: run handles stderr output", async (t) => {
  const commands = await makeCommands("shell");
  const context = makeContext(t);

  await commands.run("!echo oops 2>&1", context);

  assert.equal(context.messages.length, 3);
  const toolMsg = /** @type {ToolMessage} */ (context.messages[2]);
  assert.match(toolMsg.content, /oops/);
});

test("shell command: run with no output records placeholder", async (t) => {
  const commands = await makeCommands("shell");
  const context = makeContext(t);

  await commands.run("!:", context);

  assert.equal(context.messages.length, 3);
  const toolMsg = /** @type {ToolMessage} */ (context.messages[2]);
  assert.equal(toolMsg.content, "(no output)");
});

test("shell command: tool_call_id is consistent across messages", async (t) => {
  const commands = await makeCommands("shell");
  const context = makeContext(t);

  await commands.run("!true", context);

  const assistantMsg = /** @type {AssistantMessage} */ (context.messages[1]);
  const toolMsg = /** @type {ToolMessage} */ (context.messages[2]);
  assert.equal(assistantMsg.tool_calls?.[0]?.id, toolMsg.tool_call_id);
});

test("Commands.run throws for unknown command", async (t) => {
  const commands = await makeCommands("shell");
  const context = makeContext(t);

  await assert.rejects(() => commands.run("ls", context), /Unknown command/);
});

test("shell command: complete returns suggestions", async (t) => {
  const commands = await makeCommands("shell");
  const context = makeContext(t);
  const completions = await commands.complete("!", context);

  assert.ok(completions.some((c) => c.startsWith("!")));
});
