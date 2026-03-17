import fs from 'node:fs/promises'

export const name = 'read_directory'
export const description = 'Read the contents of a directory given its path.'
export const parameters = {
  type: 'object',
  required: ['path'],
  properties: {
    path: {
      type: 'string', description: 'The absolute or relative path to the directory'
    }
  }
}

export default async function readDirectory ({ path }) {
  try {
    const contents = await fs.readdir(path)
    return contents
  } catch (e) {
    return { error: e.message }
  }
}
