import path from "node:path";
import fs from "node:fs/promises";

const SESSION_SEP = "__";

export class Session {
  #parent;
  #slug;

  /**
   * @param {Sessions} parent
   * @param {string} slug
   */
  constructor(parent, slug) {
    this.#parent = parent;
    this.#slug = slug;
  }

  /** @returns {string} */
  get slug() {
    return this.#slug;
  }

  /**
   * @param {import('./index.js').Message[]} messages
   */
  async save(messages) {
    return this.#parent.save(this.#slug, messages);
  }

  /** @returns {Promise<import('./index.js').Message[]>} */
  async load() {
    return this.#parent.load(this.#slug);
  }

  async forget() {
    return this.#parent.forget(this.#slug);
  }
}

export class Sessions {
  #sessionFolder;
  /**
   * @param {string} sessionFolder
   */
  constructor(sessionFolder) {
    this.#sessionFolder = sessionFolder;
  }

  /**
   * @param {string} [session] Session name to add to current folder
   */
  slug(session = "default") {
    return (
      process.cwd().replaceAll(path.sep, SESSION_SEP) + SESSION_SEP + session
    );
  }

  /**
   * @param {string} [session]
   * @returns {Session}
   */
  make(session = "default") {
    const slug = this.slug(session);
    return new Session(this, slug);
  }

  /** @param {string} slug */
  #file(slug) {
    return path.join(this.#sessionFolder, slug + ".session.json");
  }

  /**
   * @param {string} slug
   * @param {import('./index.js').Message[]} messages
   */
  async save(slug, messages) {
    const sessionFile = this.#file(slug);
    await fs.writeFile(sessionFile, JSON.stringify(messages, null, "\t"));
  }

  /**
   * @param {string} slug
   * @returns {Promise<import('./index.js').Message[]>} messages
   */
  async load(slug) {
    await fs.mkdir(this.#sessionFolder, { recursive: true });
    const sessionFile = this.#file(slug);
    try {
      const data = await fs.readFile(sessionFile, "utf8");
      // TODO: Validate?
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * @param {string} slug
   */
  async forget(slug) {
    await fs.unlink(this.#file(slug));
  }
}
