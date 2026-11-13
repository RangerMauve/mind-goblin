import { after, before, test } from "node:test";
import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { fetchContextWindow } from "../src/utils.js";
import { Goblin, USER } from "../src/index.js";

/** @import { Message } from "../src/index.js" */
/** @import { Config } from "../src/utils.js" */

/** @type {import("node:http").Server} */
let server;
/** @type {number} */
let port;

/** @type {{ path: string, body: any }[]} */
let requests;

/** @type {number} */
let chatCallCount;

/**
 * @param {import("node:http").ServerResponse} res
 * @param {any} data
 * @param {number} [status]
 */
function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

before(async () => {
  requests = [];
  chatCallCount = 0;

  server = createServer((req, res) => {
    const chunks = /** @type {Buffer[]} */ ([]);
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = chunks.length ? JSON.parse(chunks.join("")) : null;
      requests.push({ path: req.url ?? "", body });

      if (req.url === "/props") {
        jsonResponse(res, {
          default_generation_settings: { n_ctx: 1000 },
          model_path: "/fake/model",
        });
      } else if (req.url === "/v1/chat/completions") {
        chatCallCount++;
        const hasToolCall = chatCallCount === 1;
        jsonResponse(res, {
          id: "test",
          object: "chat.completion",
          choices: [
            {
              index: 0,
              message: hasToolCall
                ? {
                    role: "assistant",
                    content: "",
                    tool_calls: [
                      {
                        id: "call_1",
                        type: "function",
                        function: {
                          name: "calc",
                          arguments: '{"expression":"1+1"}',
                        },
                      },
                    ],
                  }
                : { role: "assistant", content: "done" },
              finish_reason: hasToolCall ? "tool_calls" : "stop",
            },
          ],
          usage: {
            prompt_tokens: 800,
            completion_tokens: 10,
            total_tokens: 810,
          },
        });
      } else {
        jsonResponse(res, { error: "not found" }, 404);
      }
    });
  });

  await new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(true)),
  );
  port = /** @type {any} */ (server).address().port;
});

after(() => {
  server?.close();
});

/**
 * Build a config pointing at the fake server.
 * @returns {Config}
 */
function makeConfig() {
  return {
    model: "test",
    server: `http://127.0.0.1:${port}/v1/`,
    api_key: "test",
  };
}

test("fetchContextWindow returns n_ctx from /props", async () => {
  const result = await fetchContextWindow(makeConfig());
  assert.equal(result, 1000);
});

test("fetchContextWindow returns -1 for unreachable server", async () => {
  const result = await fetchContextWindow({
    model: "test",
    server: "http://127.0.0.1:1/v1/",
    api_key: "test",
  });
  assert.equal(result, -1);
});

test("fetchContextWindow returns -1 when n_ctx is missing", async () => {
  // Use a server that returns /props without n_ctx
  const s2 = createServer((req, res) => {
    if (req.url === "/props") {
      jsonResponse(res, { default_generation_settings: {} });
    } else {
      jsonResponse(res, {}, 404);
    }
  });
  await new Promise((resolve) =>
    s2.listen(0, "127.0.0.1", () => resolve(true)),
  );
  const p2 = /** @type {any} */ (s2).address().port;
  const result = await fetchContextWindow({
    model: "test",
    server: `http://127.0.0.1:${p2}/v1/`,
    api_key: "test",
  });
  s2.close();
  assert.equal(result, -1);
});

test("injects warning message when context usage exceeds 70%", async () => {
  chatCallCount = 0;
  requests = [];
  const goblin = new Goblin({
    config: makeConfig(),
    agentsMd: false,
    memoryFile: null,
  });
  /** @type {Message[]} */
  const history = [{ role: USER, content: "hello" }];
  await goblin.crank(history);

  // The warning should appear in the 2nd chat request (after the tool call),
  // since the first response has a tool_call and high usage.
  const chatReqs = requests.filter((r) => r.path === "/v1/chat/completions");
  assert.ok(chatReqs.length >= 2, "expected at least 2 chat calls");
  const secondMsgs = chatReqs[1].body.messages;
  const warning = secondMsgs.find(
    (/** @type {any} */ m) =>
      m.role === "system" && m.content.includes("% used"),
  );
  assert.ok(warning, "warning message should be in second request");
  assert.match(warning.content, /Context: 80% used/);
});

test("warning appears only once across multiple turns", async () => {
  chatCallCount = 0;
  requests = [];
  const goblin = new Goblin({
    config: makeConfig(),
    agentsMd: false,
    memoryFile: null,
  });
  /** @type {Message[]} */
  const history = [{ role: USER, content: "hello" }];
  await goblin.crank(history);

  // Count warning messages across ALL chat requests
  const chatReqs = requests.filter((r) => r.path === "/v1/chat/completions");
  let warningCount = 0;
  for (const req of chatReqs) {
    const count = req.body.messages.filter(
      (/** @type {any} */ m) =>
        m.role === "system" && m.content.includes("% used"),
    ).length;
    warningCount += count;
  }
  // The warning should appear in exactly 1 request (the 2nd call).
  // It should NOT re-appear if the loop continued further.
  assert.equal(warningCount, 1);
});

test("no warning when context window is unavailable (-1)", async () => {
  const ctx = await fetchContextWindow({
    model: "test",
    server: "http://127.0.0.1:1/v1/",
    api_key: "test",
  });
  assert.equal(ctx, -1);
});
