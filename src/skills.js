import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { conf, configDir } from "./utils.js";
import { ASSISTANT, TOOL } from "./index.js";

/** @import {Message} from "./index.js" */

/**
 * A discovered Agent Skill (see https://agentskills.io/specification).
 *
 * @typedef {object} Skill
 * @property {string} name Skill name from SKILL.md frontmatter
 * @property {string} description Description from SKILL.md frontmatter
 * @property {string} location Absolute path to the SKILL.md file
 * @property {string} dir Absolute path to the skill's directory
 */

/**
 * Minimal frontmatter parser for SKILL.md files. Extracts the YAML block
 * between the leading `---` delimiters and reads top-level `key: value`
 * pairs. Nested values (e.g. under `metadata:`) are ignored.
 *
 * @param {string} raw Full SKILL.md content
 * @param {string} location Absolute path to the SKILL.md file
 * @param {string} dir Absolute path to the skill's directory
 * @returns {Skill | null} The skill, or null if frontmatter is missing or lacks name/description
 */
function parseSkill(raw, location, dir) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!match) return null;
  /** @type {Record<string, string>} */
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (/^\s/.test(line)) continue; // nested value, e.g. under `metadata:`
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  if (!fields.name || !fields.description) return null;
  return { name: fields.name, description: fields.description, location, dir };
}

/**
 * Discovers and indexes Agent Skills from a chain of skill directories.
 *
 * Directories are scanned in ascending priority: a skill with the same name
 * in a later directory silently overwrites the earlier one.
 */
export class Skills {
  /** @type {Map<string, Skill>} */
  #skills = new Map();

  /** @type {string[]} */
  #dirs;

  /**
   * @param {string[]} [dirs] Skill directories to scan, ascending priority (later overwrites earlier)
   */
  constructor(dirs = []) {
    this.#dirs = dirs;
  }

  /**
   * The standard mind-goblin skill directory chain:
   * bundled (source) < config dir < user data dir < configured extra dirs
   * < project `.agents/skills` < project `.claude/skills`.
   * @returns {string[]}
   */
  static dirs() {
    return [
      fileURLToPath(new URL("../.agents/skills/", import.meta.url)),
      path.join(configDir, "skills"),
      ...(conf.skillsDirs ?? []),
      path.join(process.cwd(), ".agents", "skills"),
      path.join(process.cwd(), ".claude", "skills"),
    ];
  }

  /**
   * Build a Skills index from the standard directory chain.
   * @returns {Promise<Skills>}
   */
  static async default() {
    const skills = new Skills(Skills.dirs());
    await skills.discover();
    return skills;
  }

  /**
   * Scan all directories for `<dir>/<name>/SKILL.md` and (re)build the index.
   * Missing directories are ignored. Later directories overwrite earlier
   * skills with the same name, silently.
   */
  async discover() {
    this.#skills.clear();
    for (const dir of this.#dirs) {
      /** @type {import("node:fs").Dirent[]} */
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillDir = path.join(dir, entry.name);
        const location = path.join(skillDir, "SKILL.md");
        /** @type {string} */
        let raw;
        try {
          raw = await fs.readFile(location, "utf8");
        } catch {
          continue;
        }
        const skill = parseSkill(raw, location, skillDir);
        if (skill) this.#skills.set(skill.name, skill);
      }
    }
  }

  /**
   * @returns {Skill[]} All skills, sorted by name
   */
  list() {
    return [...this.#skills.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  /**
   * @param {string} name
   * @returns {Skill | null}
   */
  get(name) {
    return this.#skills.get(name) ?? null;
  }

  /**
   * Load a skill into the conversation by appending a simulated read tool
   * call and its result. The tool_call_id is prefixed `skill_` so that
   * simulated reads can be distinguished from the model's own reads.
   *
   * @param {string} name Skill name
   * @param {Message[]} messages Conversation messages, mutated in place
   * @returns {Promise<string | null>} The tool_call_id used, or null if the skill is unknown
   */
  async loadInto(name, messages) {
    const record = this.#skills.get(name);
    if (!record) return null;
    const raw = await fs.readFile(record.location, "utf8");
    const id = `skill_${record.name}_${Date.now()}`;
    messages.push(
      {
        role: ASSISTANT,
        content: "",
        tool_calls: [
          {
            type: "function",
            id,
            function: {
              name: "read",
              arguments: JSON.stringify({ path: record.location }),
            },
          },
        ],
      },
      { role: TOOL, name: "read", tool_call_id: id, content: raw },
    );
    return id;
  }

  /**
   * Names of skills whose simulated read is present in the conversation.
   * Works on freshly loaded session history too, since the state lives in
   * the messages themselves.
   *
   * @param {Message[]} messages
   * @returns {Set<string>} Skill names
   */
  findActive(messages) {
    /** @type {Map<string, string>} */
    const byLocation = new Map();
    for (const s of this.#skills.values()) byLocation.set(s.location, s.name);
    /** @type {Set<string>} */
    const active = new Set();
    for (const m of messages) {
      if (m.role !== ASSISTANT || !m.tool_calls) continue;
      for (const tc of m.tool_calls) {
        if (!tc.id?.startsWith("skill_")) continue;
        if (tc.function.name !== "read") continue;
        try {
          const args = JSON.parse(tc.function.arguments);
          const name = byLocation.get(args.path);
          if (name) active.add(name);
        } catch {
          // malformed arguments, ignore
        }
      }
    }
    return active;
  }

  /**
   * Unload a skill: remove its simulated read tool call and result from the
   * conversation. All occurrences are removed.
   *
   * @param {string} name Skill name
   * @param {Message[]} messages Conversation messages, mutated in place
   * @returns {boolean} Whether a loaded skill was found and removed
   */
  unloadFrom(name, messages) {
    const record = this.#skills.get(name);
    if (!record) return false;
    /** @type {Set<string>} */
    const ids = new Set();
    for (const m of messages) {
      if (m.role !== ASSISTANT || !m.tool_calls) continue;
      for (const tc of m.tool_calls) {
        if (!tc.id?.startsWith("skill_")) continue;
        if (tc.function.name !== "read") continue;
        try {
          const args = JSON.parse(tc.function.arguments);
          if (args.path === record.location) ids.add(tc.id);
        } catch {
          // malformed arguments, ignore
        }
      }
    }
    if (ids.size === 0) return false;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === TOOL) {
        const toolCallId = m.tool_call_id;
        if (toolCallId && ids.has(toolCallId)) messages.splice(i, 1);
      } else if (
        m.role === ASSISTANT &&
        m.tool_calls?.some((tc) => {
          const id = tc.id;
          return !!id && ids.has(id);
        })
      ) {
        const calls = m.tool_calls.filter((tc) => {
          const id = tc.id;
          return !(id && ids.has(id));
        });
        if (calls.length === 0) messages.splice(i, 1);
        else m.tool_calls = calls;
      }
    }
    return true;
  }
}
