import { Goblin } from "../src/index.js";
import { REPLContext } from "../src/repl.js";
import { Sessions } from "../src/sessions.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";

/** @import {Logger} from "../src/logger.js" */

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
  const goblin = new Goblin({});
  const sessions = new Sessions(dir);
  const session = sessions.make();
  const context = new REPLContext(goblin, session, logger);
  t.after(() => rm(dir, { recursive: true, force: true }));
  return context;
}
