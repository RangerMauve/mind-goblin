import { test } from "node:test";
import { strict as assert } from "node:assert";
import { Goblin, USER } from "../src/index.js";

/** @import { Message } from "../src/index.js" */

/** @type {number} */
let chatCallCount;
/** @type {any[]} */
let chatRequests;

/**
 * @param {any} data
 * @param {number} [status]
 * @returns {Response}
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Build a mock fetch that scripts one response per chat call.
 * @param {(Response | (() => Response))[]} responses
 * @returns {typeof globalThis.fetch}
 */
function makeFetchMock(responses) {
  chatCallCount = 0;
  chatRequests = [];
  return async (_url, /** @type {RequestInit | undefined} */ init) => {
    const call = chatCallCount++;
    chatRequests.push(JSON.parse(/** @type {string} */ (init?.body)));
    if (call >= responses.length) {
      return jsonResponse({ error: "unexpected extra chat call" }, 500);
    }
    const r = responses[call];
    return typeof r === "function" ? r() : r;
  };
}

/** @returns {import("../src/utils.js").Config} */
function makeConfig() {
  return {
    model: "test",
    server: "http://127.0.0.1:1/v1/",
    api_key: "test",
  };
}

/**
 * @param {typeof globalThis.fetch} fetchMock
 * @param {object} [opts] Extra Goblin options
 */
function makeGoblin(fetchMock, opts = {}) {
  return new Goblin({
    config: makeConfig(),
    agentsMd: false,
    memoryFile: null,
    fetch: fetchMock,
    ...opts,
  });
}

const toolCallResponse = () =>
  jsonResponse({
    id: "test",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "calc", arguments: '{"expression":"1+1"}' },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: null,
  });

/** @param {string} content */
const doneResponse = (content) => () =>
  jsonResponse({
    id: "test",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: null,
  });

test("interjection re-cranks and keeps completed tool results in history", async () => {
  const goblin = makeGoblin(
    makeFetchMock([
      toolCallResponse(),
      toolCallResponse(),
      doneResponse("ok, stopping"),
    ]),
  );
  /** @type {Message[]} */
  const history = [{ role: USER, content: "hello" }];

  /** @type {number} */
  let checks = 0;
  const result = await goblin.crank(history, {
    onInterjection: () => {
      checks += 1;
      // Interject after the 2nd chat (the one that returned tc2)
      return checks === 2 ? "hold on, do this instead" : "";
    },
  });

  assert.equal(result.content, "ok, stopping");
  assert.equal(chatCallCount, 3, "expected 3 chat calls");
  assert.equal(checks, 3, "checked after the first chat and before the next");

  // Only the final message is mirrored into history; the interjection and
  // tool work live in the working messages for the rest of the turn.
  assert.equal(/** @type {Message} */ (history.at(-1)).content, "ok, stopping");

  // The 2nd request (the re-crank) contains the tool result AND the
  // interjection.
  const secondMsgs = /** @type {any[]} */ (chatRequests[1].messages);
  assert.ok(
    secondMsgs.some((m) => m.role === "tool" && m.tool_call_id === "call_1"),
    "completed tool result should be kept",
  );
  assert.ok(
    secondMsgs.some(
      (m) => m.role === USER && m.content === "hold on, do this instead",
    ),
    "interjection should be in the re-cranked request",
  );
});

test("interjection during the re-crank is handled too", async () => {
  const goblin = makeGoblin(
    makeFetchMock([
      toolCallResponse(),
      toolCallResponse(),
      toolCallResponse(),
      doneResponse("finally done"),
    ]),
  );
  /** @type {Message[]} */
  const history = [{ role: USER, content: "hello" }];

  /** @type {number} */
  let checks = 0;
  const result = await goblin.crank(history, {
    onInterjection: () => {
      checks += 1;
      return checks <= 3 ? `interjection ${checks}` : "";
    },
  });

  assert.equal(result.content, "finally done");
  // Each interjection reaches the subsequent chat request.
  for (const i of [1, 2, 3]) {
    assert.ok(
      chatRequests.some((req) =>
        /** @type {any[]} */ (req.messages).some(
          (m) => m.role === USER && m.content === `interjection ${i}`,
        ),
      ),
      `interjection ${i} should appear in a chat request`,
    );
  }
});

test("interjection after a plain response (no tool calls)", async () => {
  const goblin = makeGoblin(
    makeFetchMock([doneResponse("first answer"), doneResponse("second")]),
  );
  /** @type {Message[]} */
  const history = [{ role: USER, content: "hello" }];

  /** @type {number} */
  let checks = 0;
  const result = await goblin.crank(history, {
    onInterjection: () => {
      checks += 1;
      return checks === 1 ? "wait, actually" : "";
    },
  });

  assert.equal(result.content, "second");
  assert.equal(/** @type {Message} */ (history.at(-1)).content, "second");
});

test("multi-line interjection is passed through as one user message", async () => {
  const goblin = makeGoblin(
    makeFetchMock([doneResponse("a"), doneResponse("b")]),
  );
  /** @type {Message[]} */
  const history = [{ role: USER, content: "hello" }];

  /** @type {number} */
  let checks = 0;
  await goblin.crank(history, {
    onInterjection: () => {
      checks += 1;
      return checks === 1 ? "first line\nsecond line" : "";
    },
  });

  const secondMsgs = /** @type {any[]} */ (chatRequests[1].messages);
  const multi = secondMsgs.filter(
    (m) => m.role === USER && m.content.includes("\n"),
  );
  assert.equal(multi.length, 1, "one user message for the interjection");
  assert.equal(multi[0].content, "first line\nsecond line");
});

test("no interjection behaves as before", async () => {
  const goblin = makeGoblin(
    makeFetchMock([toolCallResponse(), doneResponse("done")]),
  );
  /** @type {Message[]} */
  const history = [{ role: USER, content: "hello" }];

  /** @type {number} */
  let checks = 0;
  const result = await goblin.crank(history, {
    onInterjection: () => {
      checks += 1;
      return "";
    },
  });

  assert.equal(result.content, "done");
  assert.equal(chatCallCount, 2);
  assert.equal(checks, 2, "checked after the first chat and before the next");
});

test("interjection with thinkingHistory does not duplicate messages", async () => {
  const goblin = makeGoblin(
    makeFetchMock([
      toolCallResponse(),
      toolCallResponse(),
      doneResponse("done"),
    ]),
    { thinkingHistory: true },
  );
  /** @type {Message[]} */
  const history = [{ role: USER, content: "hello" }];

  /** @type {number} */
  let checks = 0;
  await goblin.crank(history, {
    onInterjection: () => {
      checks += 1;
      return checks === 2 ? "hold on" : "";
    },
  });

  const doneCount = history.filter((m) => m.content === "done").length;
  assert.equal(doneCount, 1, "final message should appear exactly once");
  const holdCount = history.filter((m) => m.content === "hold on").length;
  assert.equal(holdCount, 1, "interjection should appear exactly once");
});
