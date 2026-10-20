import { afterEach, beforeEach, test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import searchWeb, {
  name,
  parameters,
  parseResults,
  readonly,
} from "../src/tools/search_web.js";

const FIXTURE = readFileSync(
  join(import.meta.dirname, "fixtures", "ddg-search.html"),
  "utf8",
);

/**
 * Replace the global fetch with a stub.
 * @param {typeof globalThis.fetch} stub
 */
function mockFetch(stub) {
  globalThis.fetch = stub;
}

/**
 * Build a real Response with the given status and body.
 * @param {object} opts
 * @param {number} [opts.status]
 * @param {string} [opts.body]
 */
function makeResponse({ status = 200, body = "" }) {
  return new Response(body, { status });
}

/** @type {typeof globalThis.fetch} */
let originalFetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("search_web tool metadata is correct", () => {
  assert.equal(name, "search_web");
  assert.equal(readonly, true);
  assert.deepEqual(parameters.required, ["query"]);
});

test("search_web parses the DuckDuckGo result fixture", async () => {
  mockFetch(async () => makeResponse({ body: FIXTURE }));
  const result = await searchWeb({ query: "cats" });
  assert.ok("results" in result);
  assert.equal(result.results.length, 10);
  const first = result.results[0];
  assert.equal(first.title, "Cat - Wikipedia");
  assert.equal(first.url, "https://en.wikipedia.org/wiki/Cat");
  assert.ok(first.abstract.startsWith("The cat (Felis catus)"));
});

test("search_web honours the num option", async () => {
  mockFetch(async () => makeResponse({ body: FIXTURE }));
  const result = await searchWeb({ query: "cats", num: 3 });
  assert.ok("results" in result);
  assert.equal(result.results.length, 3);
});

test("parseResults caps results at num", () => {
  const all = parseResults(FIXTURE, 10);
  assert.equal(all.length, 10);
  const few = parseResults(FIXTURE, 2);
  assert.equal(few.length, 2);
  assert.equal(few[0].title, all[0].title);
});

test("search_web reports the bot challenge page as an error", async () => {
  const challenge =
    '<html><body><div class="anomaly-modal"><form id="challenge-form"></form></div></body></html>';
  mockFetch(async () => makeResponse({ body: challenge }));
  const result = await searchWeb({ query: "cats" });
  assert.ok("error" in result);
  assert.match(result.error, /bot challenge/);
});

test("search_web reports non-200 responses as an error", async () => {
  mockFetch(async () => makeResponse({ status: 503, body: "" }));
  const result = await searchWeb({ query: "cats" });
  assert.ok("error" in result);
  assert.match(result.error, /503/);
});
