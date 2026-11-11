import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Skills } from "../src/skills.js";
import { ASSISTANT, TOOL, USER } from "../src/index.js";

/** @import {Message} from "../src/index.js" */

/**
 * Write a SKILL.md into `<base>/<name>/`.
 * @param {string} base
 * @param {string} name
 * @param {string} content
 */
async function writeSkill(base, name, content) {
  const dir = path.join(base, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "SKILL.md"), content);
}

const ALPHA = `---
name: alpha
description: Does alpha things.
---
Alpha instructions.
`;

const BETA_V1 = `---
name: beta
description: Beta from the lower-priority dir.
---
Beta v1.
`;

const BETA_V2 = `---
name: beta
description: Beta from the higher-priority dir.
---
Beta v2.
`;

/** @type {string} */
let tmp;

before(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "skills-test-"));
  const low = path.join(tmp, "low");
  const high = path.join(tmp, "high");
  await fs.mkdir(low);
  await fs.mkdir(high);

  await writeSkill(low, "alpha", ALPHA);
  await writeSkill(low, "beta", BETA_V1);
  await writeSkill(low, "zeta", ALPHA.replace("alpha", "zeta"));
  // Skipped: missing description
  await writeSkill(low, "nodesc", `---\nname: nodesc\n---\nBody.\n`);
  // Skipped: no frontmatter
  await writeSkill(low, "nofm", "Just a markdown file.\n");
  // Ignored: directory without SKILL.md
  await fs.mkdir(path.join(low, "notaskill"));
  // Overwritten by the higher-priority dir
  await writeSkill(high, "beta", BETA_V2);
});

after(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test("discovers valid skills and sorts by name", async () => {
  const skills = new Skills([path.join(tmp, "low")]);
  await skills.discover();
  const list = skills.list();
  assert.deepEqual(
    list.map((s) => s.name),
    ["alpha", "beta", "zeta"],
  );
});

test("records carry location and dir", async () => {
  const skills = new Skills([path.join(tmp, "low")]);
  await skills.discover();
  const alpha = skills.get("alpha");
  assert.ok(alpha);
  assert.equal(alpha.description, "Does alpha things.");
  assert.equal(alpha.location, path.join(tmp, "low", "alpha", "SKILL.md"));
  assert.equal(alpha.dir, path.join(tmp, "low", "alpha"));
});

test("later directories overwrite earlier skills with the same name", async () => {
  const skills = new Skills([path.join(tmp, "low"), path.join(tmp, "high")]);
  await skills.discover();
  const beta = skills.get("beta");
  assert.ok(beta);
  assert.equal(beta.description, "Beta from the higher-priority dir.");
  assert.equal(beta.location, path.join(tmp, "high", "beta", "SKILL.md"));
});

test("missing directories are ignored", async () => {
  const skills = new Skills([path.join(tmp, "does-not-exist")]);
  await skills.discover();
  assert.deepEqual(skills.list(), []);
});

test("get returns null for unknown names", async () => {
  const skills = new Skills([path.join(tmp, "low")]);
  await skills.discover();
  assert.equal(skills.get("nope"), null);
});

test("loadInto appends a simulated read and findActive sees it", async () => {
  const skills = new Skills([path.join(tmp, "low")]);
  await skills.discover();
  /** @type {Message[]} */
  const messages = [{ role: USER, content: "hi" }];
  const id = await skills.loadInto("alpha", messages);
  assert.ok(id?.startsWith("skill_alpha_"));
  assert.equal(messages.length, 3);
  const assistant = messages[1];
  assert.equal(assistant.role, ASSISTANT);
  assert.ok(assistant.tool_calls);
  assert.deepEqual(assistant.tool_calls[0].function, {
    name: "read",
    arguments: JSON.stringify({
      path: path.join(tmp, "low", "alpha", "SKILL.md"),
    }),
  });
  const tool = messages[2];
  assert.equal(tool.role, TOOL);
  assert.equal(tool.tool_call_id, id);
  assert.match(/** @type {string} */ (tool.content), /Alpha instructions/);
  assert.deepEqual(skills.findActive(messages), new Set(["alpha"]));
});

test("findActive survives a simulated resume (fresh Skills, cloned messages)", async () => {
  const low = path.join(tmp, "low");
  const skills = new Skills([low]);
  await skills.discover();
  /** @type {Message[]} */
  const messages = [];
  await skills.loadInto("alpha", messages);
  // Simulate save + reload + a brand new discovery pass
  const reloaded = JSON.parse(JSON.stringify(messages));
  const fresh = new Skills([low]);
  await fresh.discover();
  assert.deepEqual(fresh.findActive(reloaded), new Set(["alpha"]));
});

test("findActive ignores the model's own reads (no skill_ prefix)", async () => {
  const skills = new Skills([path.join(tmp, "low")]);
  await skills.discover();
  /** @type {Message[]} */
  const messages = [
    {
      role: ASSISTANT,
      content: "",
      tool_calls: [
        {
          type: "function",
          id: "call_model_1",
          function: {
            name: "read",
            arguments: JSON.stringify({
              path: path.join(tmp, "low", "alpha", "SKILL.md"),
            }),
          },
        },
      ],
    },
    { role: TOOL, name: "read", tool_call_id: "call_model_1", content: "raw" },
  ];
  assert.deepEqual(skills.findActive(messages), new Set());
  assert.equal(skills.unloadFrom("alpha", messages), false);
  assert.equal(messages.length, 2);
});

test("unloadFrom removes the simulated read pair and returns true", async () => {
  const skills = new Skills([path.join(tmp, "low")]);
  await skills.discover();
  /** @type {Message[]} */
  const messages = [{ role: USER, content: "hi" }];
  await skills.loadInto("alpha", messages);
  assert.equal(messages.length, 3);
  assert.equal(skills.unloadFrom("alpha", messages), true);
  assert.equal(messages.length, 1);
  assert.deepEqual(skills.findActive(messages), new Set());
  assert.equal(skills.unloadFrom("alpha", messages), false);
});

test("unloadFrom leaves unrelated tool calls in a shared assistant message", async () => {
  const skills = new Skills([path.join(tmp, "low")]);
  await skills.discover();
  /** @type {Message[]} */
  const messages = [];
  await skills.loadInto("alpha", messages);
  // An assistant message with both a skill call and a normal call
  messages.push({
    role: ASSISTANT,
    content: "",
    tool_calls: [
      {
        type: "function",
        id: "call_other",
        function: { name: "shell_command", arguments: "{}" },
      },
      {
        type: "function",
        id: "skill_alpha_manual",
        function: {
          name: "read",
          arguments: JSON.stringify({
            path: path.join(tmp, "low", "alpha", "SKILL.md"),
          }),
        },
      },
    ],
  });
  messages.push({
    role: TOOL,
    name: "read",
    tool_call_id: "skill_alpha_manual",
    content: "x",
  });
  assert.equal(skills.unloadFrom("alpha", messages), true);
  const shared = messages.find((m) => m.role === ASSISTANT);
  assert.ok(shared);
  if (shared.role !== ASSISTANT || !shared.tool_calls) {
    throw new Error("not an assistant message with tool calls");
  }
  assert.deepEqual(
    shared.tool_calls.map((tc) => tc.id),
    ["call_other"],
  );
});

test("frontmatter metadata nesting is tolerated", async () => {
  const base = path.join(tmp, "meta");
  await writeSkill(
    base,
    "meta",
    `---
name: meta
description: Has nested metadata.
metadata:
  author: someone
  version: "1.0"
---
Body.
`,
  );
  const skills = new Skills([base]);
  await skills.discover();
  const meta = skills.get("meta");
  assert.ok(meta);
  assert.equal(meta.description, "Has nested metadata.");
});
