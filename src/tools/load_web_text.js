import TurndownService from "turndown";

export const name = "load_web_text";

export const description = "Fetches text content from a provided URL.";

export const parameters = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "The URL to fetch text from.",
    },
  },
  required: ["url"],
};

const turndownService = new TurndownService();
turndownService.remove("script");
turndownService.remove("style");

/**
 * @param {object} parameters
 * @param {string} parameters.url - The URL to fetch text content from
 * @returns {Promise<{text: string}|{error: string}>} - Text content from the fetched URL
 */
export default async function loadWebText({ url }) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { error: "Failed to fetch the URL. Status: " + response.status };
    }
    const text = await response.text();

    const contentType = response.headers.get("Content-Type");
    const isHtml = contentType ? contentType.includes("text/html") : false;
    if (isHtml) {
      const cleaned = turndownService.turndown(text);
      return { text: cleaned };
    }
    return { text };
  } catch (error) {
    return {
      error: "An unexpected error occurred while fetching: " + error.message,
    };
  }
}
