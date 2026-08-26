#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { program } from "commander";

import { Goblin } from "./index.js";
import { repl } from "./repl.js";
import speakTool from "./tools/speak.js";
import { conf } from "./utils.js";

program
  .name("mind-goblin")
  .description("Your local ai assistant.")
  .option("--debug", "output extra debug info to inspect the train of thought")
  .option("--readonly", "refuse to use write or edit tools", conf.readonly);

program
  .command("transform")
  .description("Transform a file in place")
  .argument("<prompt>", "The task you wish for the assistant to complete")
  .argument("<file>", "the file to refactor")
  .action(
    /**
     * @param {string} prompt The task you wish for the assistant to complete
     * @param {string} file The file to transform
     * @param {object} options Parsed commander options
     */
    async (prompt, file, options) => {
      // Read the file up front; error if it doesn't exist.
      let content;
      try {
        content = await fs.readFile(file, "utf8");
      } catch (cause) {
        throw new Error(`Cannot read file "${file}"`, { cause });
      }
      const targetPath = path.resolve(file);

      // Fork a goblin that can only write/edit, so it can't wander off.
      const goblin = await Goblin.fromOptions({
        ...program.opts(),
        ...options,
      });
      const writer = goblin.fork({ tools: ["write_file", "edit_file"] });

      // Track whether a write/edit actually happened, and keep edits on-target.
      let toolUsed = false;

      /** @type {(name: string, args: object) => Promise<void>} */
      const onbeforetool = async (name, args) => {
        if (name === "write_file" || name === "edit_file") {
          // @ts-expect-error There should be a path, trust me
          const p = path.resolve(args.path);
          if (p !== targetPath) {
            throw new Error(
              // @ts-expect-error There should be a path, trust me
              `Refusing to modify "${args.path}"; only "${file}" may be changed.`,
            );
          }
        }
        toolUsed = true;
      };

      const instruction = `You are transforming the file "${file}".

Current contents of "${file}":
<${file}>
${content}
</${file}>

Task: ${prompt}

Apply the requested transformation and save the result back to "${file}" using the write_file tool (preferred for a full rewrite) or the edit_file tool (for targeted replacements). Only modify "${file}" — do not touch any other file. After saving, reply with a one-line summary of the changes you made.`;

      const answer = await writer.query(instruction, { onbeforetool });

      if (!toolUsed) {
        throw new Error(
          "The assistant did not use the write/edit tools, so the file was not modified.",
        );
      }

      console.log(answer);
    },
  );

program
  .command("think")
  .description("Think about a query and answer the user")
  .argument("[prompt]", "The task you wish for the assistant to complete")
  .argument("[file]")
  .option("--speak")
  .action(async (prompt, file, { speak, ...options }) => {
    const goblin = await Goblin.fromOptions({ ...program.opts(), ...options });
    // TODO: Handle file
    const content = prompt || (await collect(process.stdin));
    const answer = await goblin.query(content);
    console.log(answer);
    if (speak) {
      await speakTool({ message: answer });
    }
  });

program
  .command("chat")
  .description("Have a conversation via the TUI")
  .option("--show-thinking", "Output thinking blocks to STDOUT")
  .option("--session <name>", "Resume or start a named session", "default")
  .option("--clear", "Clear the session before starting")
  .option(
    "--thinking-history",
    "Preserve thinking history. Increases context size but speeds up inference from better caching",
  )
  .action(repl);

await program.parseAsync(process.argv);

/**
 * Collect all the data in a stream into a single blob of text.
 * Use this to get all the text out of STDIN
 * @param {AsyncIterable<Buffer>} stream
 * @returns
 */
async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  const combined = Buffer.concat(chunks).toString("utf8");

  return combined;
}
