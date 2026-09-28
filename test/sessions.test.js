import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Sessions } from "../src/sessions.js";

describe("Sessions.list", () => {
  test("returns empty array when session folder does not exist", async () => {
    const sessions = new Sessions("/nonexistent/path/that/does/not/exist");
    const names = await sessions.list();
    assert.deepEqual(names, []);
  });

  test("returns empty array when no sessions for current directory", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mg-sessions-"));
    try {
      // Create an unrelated session file (different directory)
      await fs.writeFile(
        path.join(tmp, "some__other__dir__foo.session.json"),
        "[]",
      );
      const sessions = new Sessions(tmp);
      const names = await sessions.list();
      assert.deepEqual(names, []);
    } finally {
      await fs.rm(tmp, { recursive: true });
    }
  });

  test("lists session names for the current directory", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mg-sessions-"));
    try {
      const dirSlug = process.cwd().replaceAll(path.sep, "__");
      const files = [
        `${dirSlug}__alpha.session.json`,
        `${dirSlug}__default.session.json`,
        `${dirSlug}__zeta.session.json`,
      ];
      for (const f of files) {
        await fs.writeFile(path.join(tmp, f), "[]");
      }
      // Session in a subdirectory of cwd — should be filtered out
      await fs.writeFile(
        path.join(tmp, `${dirSlug}__subdir__default.session.json`),
        "[]",
      );
      // Session from a completely different directory — should not match prefix
      await fs.writeFile(path.join(tmp, "other__dir__beta.session.json"), "[]");
      // Non-session file
      await fs.writeFile(path.join(tmp, `${dirSlug}__notasession.txt`), "x");

      const sessions = new Sessions(tmp);
      const names = await sessions.list();
      assert.deepEqual(names, ["alpha", "default", "zeta"]);
    } finally {
      await fs.rm(tmp, { recursive: true });
    }
  });
});
