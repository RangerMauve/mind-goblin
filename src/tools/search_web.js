// @ts-expect-error domino's types declare module 'domino', not the scoped package name
import * as domino from "@mixmark-io/domino";

export const name = "search_web";
export const readonly = true;

export const description =
  "Search the web. Returns a list of results, each with a title, url and abstract.";

export const parameters = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "The search query",
    },
    num: {
      type: "number",
      description: "Maximum number of results to return (default 10)",
    },
  },
  required: ["query"],
};

const DDG_URL = "https://html.duckduckgo.com/html";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200;

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * @typedef {object} DdgResult
 * @property {string} title
 * @property {string} url
 * @property {string} abstract
 */

/**
 * Parse a DuckDuckGo HTML result page into a list of results.
 * @param {string} html The raw result page HTML
 * @param {number} num Maximum number of results to return
 * @returns {DdgResult[]}
 */
export function parseResults(html, num) {
  const doc = domino.createDocument(html, true);
  const blocks = doc.querySelectorAll("div.links_main");
  /** @type {DdgResult[]} */
  const results = [];
  for (const block of blocks) {
    const a = block.querySelector(".result__title a");
    if (!a) continue;
    const title = (a.textContent ?? "").trim();
    const url = a.getAttribute("href") ?? "";
    const abstract = (
      block.querySelector(".result__snippet")?.textContent ?? ""
    ).trim();
    results.push({ title, url, abstract });
    if (results.length >= num) break;
  }
  return results;
}

/**
 * Search the web using DuckDuckGo, mirroring ddgr's first-page request.
 * @param {object} parameters
 * @param {string} parameters.query - The search query
 * @param {number} [parameters.num] - Max results to return (default 10)
 * @param {unknown} [context]
 * @param {AbortSignal} [signal]
 * @returns {Promise<{results: DdgResult[]}|{error: string}>}
 */
export default async function searchWeb({ query, num = 10 }, context, signal) {
  const body = new URLSearchParams({
    q: query,
    b: "",
    df: "",
    kf: "-1",
    kh: "1",
    kl: "us-en",
    // Disable safe search
    kp: "-2",
    k1: "-1",
  });

  /** @type {Response | null} */
  let response = null;
  let lastError;
  for (let attempt = 0; ; attempt++) {
    try {
      response = await fetch(DDG_URL, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept-Encoding": "gzip",
          "User-Agent": USER_AGENT,
          DNT: "1",
        },
        body: body.toString(),
      });
      break;
    } catch (e) {
      if (signal?.aborted) {
        return { error: "Search cancelled" };
      }
      lastError = e;
      // Check this before we sleep for next round
      if (attempt >= MAX_RETRIES) {
        break;
      }
      await sleep(RETRY_DELAY_MS);
    }
  }

  if (!response) {
    return {
      error:
        "Failed to reach DuckDuckGo after " +
        (MAX_RETRIES + 1) +
        " attempts: " +
        lastError.message,
    };
  }

  if (!response.ok) {
    return { error: "DuckDuckGo returned HTTP " + response.status };
  }

  const html = await response.text();
  const doc = domino.createDocument(html, true);

  if (doc.querySelector("#challenge-form, .anomaly-modal")) {
    return {
      error:
        "DuckDuckGo served a bot challenge. Try again later or from a different network.",
    };
  }

  return { results: parseResults(html, num) };
}
