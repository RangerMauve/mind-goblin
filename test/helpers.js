import { Goblin } from "../src/index.js";
import { REPLContext } from "../src/repl.js";
import { Sessions } from "../src/sessions.js";
import { Tools } from "../src/tools.js";
import { Commands } from "../src/commands.js";
import { Logger } from "../src/logger.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

/**
 * Create a REPLContext backed by a minimal Goblin and a temp session.
 * Registers cleanup via t.after() to remove the session dir.
 * @param {import("node:test").TestContext} t The test context for cleanup registration
 * @param {Logger} [logger] Optional custom logger
 * @returns {REPLContext}
 */
export function makeContext(t, logger) {
  const dir = join(
    tmpdir(),
    `mind-goblin-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  const goblin = new Goblin({});
  const sessions = new Sessions(dir);
  const session = sessions.make();
  const context = new REPLContext(goblin, session, { logger });
  t.after(() => rm(dir, { recursive: true, force: true }));
  return context;
}

/**
 * Create a Goblin with the standard tool set.
 * @param {object} [opts] Additional Goblin constructor options
 * @returns {Promise<Goblin>}
 */
export async function makeGoblin(opts = {}) {
  const tools = await Tools.default();
  return new Goblin({ tools, ...opts });
}

/**
 * Create a temp directory and register cleanup via t.after().
 * @param {import("node:test").TestContext} t The test context for cleanup registration
 * @returns {Promise<string>} The path to the temp directory
 */
export async function makeTempDir(t) {
  const dir = await mkdtemp(join(tmpdir(), "mind-goblin-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * Create a REPLContext with a Logger that captures all log output into an array.
 * @param {import("node:test").TestContext} t The test context for cleanup registration
 * @returns {{context: REPLContext, logged: string[]}}
 */
export function makeRecordingContext(t) {
  /** @type {string[]} */
  const logged = [];
  const logger = new Logger({
    log: (msg) => logged.push(msg),
    useColors: false,
  });
  const context = makeContext(t, logger);
  return { context, logged };
}

/**
 * Create a Commands instance with the given command names loaded.
 * @param {...string} names Command names to load (without leading / or !)
 * @returns {Promise<Commands>}
 */
export async function makeCommands(...names) {
  const commands = new Commands();
  for (const name of names) {
    await commands.load(name);
  }
  return commands;
}
