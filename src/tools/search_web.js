/** @type {string} */
export const name = "search_web";
export const readonly = true;

/** @type {string} */
export const description = "Search the web using SearXNG.";

/** @type {object} */
export const parameters = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "The search query",
    },
  },
  required: ["query"],
};

/**
 * @typedef {object} WikiResults
 * @property {WikiResult[]} [results]
 */

/**
 * @typedef {object} WikiResult
 * @property {string} [title]
 * @property {string} [url]
 * @property {string} [content]
 * @property {string} [snippet]
 */

/**
 * Search the web using SearXNG.
 * @param {object} parameters
 * @param {string} parameters.query - The search query
 * @returns {Promise<{results: Array<{title: string, url: string, content: string}>}|{error: string}>}
 */
export default async function searchWeb({ query }) {
  const url = new URL("https://search.anoni.net/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);

  const response = await fetch(url.href, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ format: "json", q: query }),
  });

  try {
    const data = /** @type {WikiResults} */ (
      /** @type {unknown}*/ (await response.json())
    );

    if (!data.results || !Array.isArray(data.results)) {
      return { error: "Invalid response format from SearXNG" };
    }

    const results = data.results.map((item) => ({
      title: item.title || "No title",
      url: item.url || "#",
      content: item.content || item.snippet || "No description available",
    }));

    return { results };
  } catch (e) {
    return { error: "Failed to parse SearXNG response: " + e.message };
  }
}
