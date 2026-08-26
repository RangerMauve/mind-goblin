import striptags from "striptags";

export const name = "search_wikipedia";
export const readonly = true;
export const description = "Search for information on Wikipedia.";
export const parameters = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "The search query for Wikipedia",
    },
  },
  required: ["query"],
};

/**
 * Search for information on Wikipedia.
 * @param {object} parameters
 * @param {string} parameters.query
 * @returns
 */
export default async function searchWikipedia({ query }) {
  const url = new URL(
    "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&limit=1",
  );
  url.searchParams.set("srsearch", query);
  const response = await fetch(url.href);
  try {
    const results = await response.json();
    const snippet = striptags(results.query.search[0].snippet);
    return { snippet };
  } catch (e) {
    return { error: e.message };
  }
}
