#!/usr/bin/env node
import { program } from "commander";

import { Goblin } from "./index.js";
import { repl } from "./repl.js";
import speakTool from "./tools/speak.js";

program
  .name("mind-goblin")
  .description("Your local ai assistant.")
  .option(
    "-s, --system <type>",
    "Custom system prompt for the assistant",
    "You are a local assistant named Mind Goblin.",
  )
  .option("--debug", "output extra debug info to inspect the train of thought");

program
  .command("transform")
  .description("Transform a file or the clipboard buffer")
  .argument("<prompt>", "The task you wish for the assistant to complete")
  .argument("[file]", "the file to refactor, omit this to pull from clipboard")
  .action((file, options) => {
    if (file) {
      // Read file
    } else {
      // load clipboard into history
    }
    console.log(options);
    throw new Error("Not yet implemented");
  });

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
