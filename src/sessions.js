import path from 'node:path'
import fs from 'node:fs/promises'

const SESSION_SEP = '__'

export class Sessions {
  #sessionFolder
  /**
   * @param {string} sessionFolder
   */
  constructor (sessionFolder) {
    this.#sessionFolder = sessionFolder
  }

  /**
   * @param {string} [session] Session name to add to current folder
   */
  slug (session = 'default') {
    return process.cwd().replaceAll(path.sep, SESSION_SEP) + SESSION_SEP + session
  }

  /** @param {string} slug */
  #file (slug) {
    return path.join(this.#sessionFolder, slug + '.session.json')
  }

  /**
   * @param {string} slug
   * @param {import('./index.js').Message[]} messages
   */
  async save (slug, messages) {
    const sessionFile = this.#file(slug)
    await fs.writeFile(sessionFile, JSON.stringify(messages, null, '\t'))
  }

  /**
   * @param {string} slug
   * @returns {Promise<import('./index.js').Message[]>} messages
   */
  async load (slug) {
    await fs.mkdir(this.#sessionFolder, { recursive: true })
    const sessionFile = this.#file(slug)
    try {
      const data = await fs.readFile(sessionFile, 'utf8')
      // TODO: Validate?
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  async forget (slug) {
    await fs.unlink(this.#file(slug))
  }
}
