import path from "node:path";
import fs from "node:fs/promises";

const SESSION_SEP = "__";

export class Session {
  #parent;
  #slug;
  #name;

  /**
   * @param {Sessions} parent
   * @param {string} slug
   * @param {string} [name]
   */
  constructor(parent, slug, name = "default") {
    this.#parent = parent;
    this.#slug = slug;
    this.#name = name;
  }

  /** @returns {string} */
  get slug() {
    return this.#slug;
  }

  /** @returns {string} */
  get name() {
    return this.#name;
  }

  /** @param {string} name @returns {Session} */
  fork(name) {
    return this.#parent.make(name);
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
    return new Session(this, slug, session);
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

  /**
   * List session names for the current working directory.
   * @returns {Promise<string[]>} Sorted list of session names
   */
  async list() {
    const dirPrefix = process.cwd().replaceAll(path.sep, SESSION_SEP);
    const suffix = ".session.json";
    let files;
    try {
      files = await fs.readdir(this.#sessionFolder);
    } catch {
      return [];
    }
    const prefix = dirPrefix + SESSION_SEP;
    return files
      .filter((f) => f.startsWith(prefix) && f.endsWith(suffix))
      .map((f) => f.slice(prefix.length, -suffix.length))
      .filter((name) => !name.includes(SESSION_SEP))
      .sort();
  }
}
