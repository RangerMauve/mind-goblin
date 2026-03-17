import fs from 'node:fs/promises'

export const name = 'read_file'
export const description = 'Read the contents of a file given its path.'
export const parameters = {
  type: 'object',
  required: ['path'],
  properties: {
    path: {
      type: 'string', description: 'The absolute or relative path to the file'
    }
  }
}

/**
 * Reads text content from a file given its path.
 * @param {object} parameters
 * @param {string} parameters.path - The absolute or relative path to the file
 * @returns {Promise<{content:string}|{error: string}>} - The file contents
 */
export default async function readFile ({ path }) {
  try {
    const content = await fs.readFile(path, 'utf8')
    return { content }
  } catch (e) {
    return { error: e.message }
  }
}
