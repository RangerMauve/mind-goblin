import { test } from "node:test";
import { strict as assert } from "node:assert";
import { Goblin, SYSTEM, USER } from "../src/index.js";

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

const overflowResponse = () =>
  jsonResponse(
    {
      error: {
        code: 400,
        message:
          "request exceeds the available context size, try increasing it",
        type: "exceed_context_size_error",
        n_prompt_tokens: 311273,
        n_ctx: 262144,
      },
    },
    400,
  );

const doneResponse = () =>
  jsonResponse({
    id: "test",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "done" },
        finish_reason: "stop",
      },
    ],
    usage: null,
  });

test("recovers from context overflow by dropping the tool call and re-cranking", async () => {
  const goblin = makeGoblin(
    makeFetchMock([toolCallResponse(), overflowResponse(), doneResponse()]),
  );
  /** @type {Message[]} */
  const history = [{ role: USER, content: "hello" }];
  const result = await goblin.crank(history);

  assert.equal(result.content, "done");
  assert.equal(/** @type {Message} */ (history.at(-1)).content, "done");
  assert.equal(chatCallCount, 3, "expected 3 chat calls");

  // The 2nd request contained the tool call + result
  const secondMsgs = /** @type {any[]} */ (chatRequests[1].messages);
  assert.ok(
    secondMsgs.some((m) => m.role === "tool" && m.tool_call_id === "call_1"),
    "second request should contain the tool result",
  );

  // The 3rd request dropped the assistant tool_call + tool result,
  // and includes the overflow notice
  const thirdMsgs = /** @type {any[]} */ (chatRequests[2].messages);
  assert.ok(
    !thirdMsgs.some((m) => m.role === "tool"),
    "tool result should be dropped",
  );
  assert.ok(
    !thirdMsgs.some((m) => m.role === "assistant" && m.tool_calls?.length),
    "assistant tool_call message should be dropped",
  );
  const notice = thirdMsgs.find(
    (/** @type {any} */ m) =>
      m.role === SYSTEM && m.content.includes("context window"),
  );
  assert.ok(notice, "overflow notice should be present");
  assert.match(/** @type {string} */ (notice.content), /prune or compact/);
});

test("does not duplicate the final message with thinkingHistory", async () => {
  const goblin = makeGoblin(
    makeFetchMock([toolCallResponse(), overflowResponse(), doneResponse()]),
    { thinkingHistory: true },
  );
  /** @type {Message[]} */
  const history = [{ role: USER, content: "hello" }];
  await goblin.crank(history);

  const doneCount = history.filter((m) => m.content === "done").length;
  assert.equal(doneCount, 1, "final message should appear exactly once");
});

test("rethrows non-overflow API errors", async () => {
  const goblin = makeGoblin(
    makeFetchMock([jsonResponse({ error: "boom" }, 500)]),
  );
  /** @type {Message[]} */
  const history = [{ role: USER, content: "hello" }];
  await assert.rejects(() => goblin.crank(history), /OpenAI API error \(500\)/);
  assert.equal(chatCallCount, 1);
});

test("rethrows overflow when there is nothing to drop", async () => {
  const goblin = makeGoblin(makeFetchMock([overflowResponse()]));
  /** @type {Message[]} */
  const history = [{ role: USER, content: "hello" }];
  await assert.rejects(
    () => goblin.crank(history),
    /exceed_context_size_error/,
  );
  assert.equal(chatCallCount, 1, "should not retry");
});
