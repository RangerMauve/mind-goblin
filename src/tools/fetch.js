import TurndownService from "turndown";

export const name = "fetch";
export const readonly = true;

export const description =
  "Fetches content from a URL. Returns text as-is, converts HTML to markdown, and returns base64 image data for image URLs.";

export const parameters = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "The URL to fetch content from.",
    },
  },
  required: ["url"],
};

const turndownService = new TurndownService({ headingStyle: "atx" });
turndownService.remove("script");
turndownService.remove("style");

/** @type {Record<string, string>} */
const IMAGE_MIME = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
  "image/bmp": "image/bmp",
  "image/x-icon": "image/x-icon",
};

/**
 * Fetches content from a URL. Converts HTML to markdown, passes through other text,
 * and returns base64 image data for image content types.
 * @param {object} parameters
 * @param {string} parameters.url - The URL to fetch content from
 * @returns {Promise<{text:string}|{image:{data:string,mime:string}}|{error:string}>}
 */
export default async function fetchUrl({ url }) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { error: "Failed to fetch the URL. Status: " + response.status };
    }
    const contentType = response.headers.get("Content-Type") ?? "";

    if (IMAGE_MIME[contentType]) {
      const buffer = Buffer.from(await response.arrayBuffer());
      return { image: { data: buffer.toString("base64"), mime: contentType } };
    }

    const text = await response.text();

    if (contentType.includes("text/html")) {
      return { text: turndownService.turndown(text) };
    }
    return { text };
  } catch (error) {
    return {
      error: "An unexpected error occurred while fetching: " + error.message,
    };
  }
}
