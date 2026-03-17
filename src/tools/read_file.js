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

export default async function readFile ({ path }) {
  try {
    const content = await fs.readFile(path, 'utf8')
    return content
  } catch (e) {
    // If the file is lost to the void or corrupted
    return { error: e.message }
  }
}
