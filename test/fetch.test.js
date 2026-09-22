import { afterEach, beforeEach, test } from "node:test";
import { strict as assert } from "node:assert";
import fetchTool, { name, parameters, readonly } from "../src/tools/fetch.js";

/**
 * Replace the global fetch with a stub.
 * @param {typeof globalThis.fetch} stub
 */
function mockFetch(stub) {
  globalThis.fetch = stub;
}

/** @type {typeof globalThis.fetch} */
let originalFetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * Build a real Response with the given content type and body.
 * @param {object} opts
 * @param {number} [opts.status]
 * @param {string} [opts.contentType]
 * @param {BodyInit | null} [opts.body]
 */
function makeResponse({ status = 200, contentType, body = "" }) {
  return new Response(body, {
    status,
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });
}

test("fetch tool metadata is correct", () => {
  assert.equal(name, "fetch");
  assert.equal(readonly, true);
  assert.deepEqual(parameters.required, ["url"]);
});

test("fetch returns plain text as-is", async () => {
  mockFetch(async () =>
    makeResponse({ contentType: "text/plain", body: "hello world" }),
  );
  const result = await fetchTool({ url: "http://example.com" });
  assert.deepEqual(result, { text: "hello world" });
});

test("fetch converts HTML to markdown", async () => {
  mockFetch(async () =>
    makeResponse({
      contentType: "text/html",
      body: "<h1>Title</h1><p>Body</p>",
    }),
  );
  const result = await fetchTool({ url: "http://example.com" });
  assert.ok("text" in result);
  assert.ok(result.text.includes("# Title"));
  assert.ok(result.text.includes("Body"));
});

test("fetch returns base64 image data for PNG", async () => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  mockFetch(async () =>
    makeResponse({ contentType: "image/png", body: bytes }),
  );
  const result = await fetchTool({ url: "http://example.com/img.png" });
  assert.ok("image" in result);
  assert.equal(result.image.mime, "image/png");
  assert.equal(result.image.data, Buffer.from(bytes).toString("base64"));
});

test("fetch returns base64 image data for JPEG", async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  mockFetch(async () =>
    makeResponse({ contentType: "image/jpeg", body: bytes }),
  );
  const result = await fetchTool({ url: "http://example.com/img.jpg" });
  assert.ok("image" in result);
  assert.equal(result.image.mime, "image/jpeg");
  assert.equal(result.image.data, Buffer.from(bytes).toString("base64"));
});

test("fetch reports non-ok status as error", async () => {
  mockFetch(async () =>
    makeResponse({ status: 404, contentType: "text/html", body: "" }),
  );
  const result = await fetchTool({ url: "http://missing.com" });
  assert.ok("error" in result);
  assert.match(result.error, /404/);
});

test("fetch reports network errors", async () => {
  mockFetch(async () => {
    throw new Error("getaddrinfo ENOTFOUND");
  });
  const result = await fetchTool({ url: "http://bad-host" });
  assert.ok("error" in result);
  assert.match(result.error, /unexpected error/i);
});
