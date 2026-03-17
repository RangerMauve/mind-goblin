import fs from 'node:fs/promises'

export const name = 'edit_file'
export const description = 'Replaces text in a file at the specified path.'
export const parameters = {
  type: 'object',
  required: ['path', 'old_text', 'new_text'],
  properties: {
    path: { type: 'string', description: 'The absolute or relative path to the file' },
    old_text: { type: 'string', description: 'The text to replace' },
    new_text: { type: 'string', description: 'The new text to insert' }
  }
}

/**
 * Replaces text in a file at the specified path.
 * @param {object} parameters
 * @param {string} parameters.path The absolute or relative path to the file
 * @param {string} parameters.old_text The text to replace
 * @param {string} parameters.new_text The new text to insert
 * @returns {Promise<{success: true, path: string}|{error: string}>}
 */
export default async function editFile ({ path, old_text, new_text }) {
  try {
    // Read the file
    const contents = await fs.readFile(path, 'utf8')

    // Check if old_text exists in the file
    if (!contents.includes(old_text)) {
      return { error: 'Old text not found in file. Use read_file to check the contents and try again.' }
    }

    // Replace old_text with new_text
    const newContents = contents.replace(old_text, new_text)

    // Write the file
    await fs.writeFile(path, newContents, 'utf8')

    return { success: true, path }
  } catch (e) {
    return { error: e.message }
  }
}
