import { test } from "node:test";
import assert from "node:assert/strict";

import { makeCommands, makeRecordingContext } from "./helpers.js";

/** @param {string} name @param {string} args @returns {import("../src/tools.js").FunctionCall} */
const toolCall = (name, args = "{}") => ({
  id: `call_${name}`,
  type: "function",
  function: { name, arguments: args },
});

test("/tail renders tool call names from assistant messages", async (t) => {
  const { context, logged } = makeRecordingContext(t);
  context.messages.push({ role: "user", content: "read that file" });
  context.messages.push({
    role: "assistant",
    content: "",
    tool_calls: [toolCall("read", JSON.stringify({ path: "foo.js" }))],
  });
  context.messages.push({
    role: "tool",
    name: "read",
    content: "file contents",
    tool_call_id: "call_read",
  });
  context.messages.push({ role: "assistant", content: "here you go" });

  const commands = await makeCommands("tail");
  await commands.run("/tail", context);

  assert.deepEqual(logged, ["read that file", "→ read", "here you go"]);
});

test("/tail renders tool call summary when present in args", async (t) => {
  const { context, logged } = makeRecordingContext(t);
  context.messages.push({ role: "user", content: "run the linter" });
  context.messages.push({
    role: "assistant",
    content: "",
    tool_calls: [
      toolCall(
        "shell_command",
        JSON.stringify({ command: "npm run lint", summary: "run the linter" }),
      ),
      toolCall("read"),
    ],
  });

  const commands = await makeCommands("tail");
  await commands.run("/tail", context);

  assert.deepEqual(logged, [
    "run the linter",
    "→ shell_command: run the linter",
    "→ read",
  ]);
});

test("/tail ignores malformed tool args without crashing", async (t) => {
  const { context, logged } = makeRecordingContext(t);
  context.messages.push({
    role: "assistant",
    content: "",
    tool_calls: [toolCall("read", "{not json")],
  });

  const commands = await makeCommands("tail");
  await commands.run("/tail", context);

  assert.deepEqual(logged, ["→ read"]);
});

test("/tail includes tool-call-only assistant messages in the count", async (t) => {
  const { context, logged } = makeRecordingContext(t);
  // Fill history so the default n=5 window matters.
  context.messages.push({ role: "user", content: "u1" });
  context.messages.push({ role: "assistant", content: "a1" });
  context.messages.push({ role: "user", content: "u2" });
  context.messages.push({ role: "assistant", content: "a2" });
  context.messages.push({ role: "user", content: "u3" });
  context.messages.push({
    role: "assistant",
    content: "",
    tool_calls: [toolCall("shell_command")],
  });

  const commands = await makeCommands("tail");
  await commands.run("/tail", context);

  // Tool-call-only assistant msg is counted even though it has no content.
  assert.ok(logged.includes("→ shell_command"));
  assert.ok(logged.includes("u3"));
  assert.ok(!logged.includes("u1"));
});
