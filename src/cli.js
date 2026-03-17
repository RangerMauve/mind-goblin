#!/usr/bin/env node
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import { program } from 'commander'

import { USER, ASSISTANT, Goblin } from './index.js'
import speakTool from './tools/speak.js'

program
  .name('mind-goblin')
  .description('Your local ai assistant.')
  .option('-s, --system <type>', 'Custom system prompt for the assistant', 'You are a local assistant named Mind Goblin.')
  .option('--debug', 'output extra debug info to inspect the train of thought')

program
  .command('transform')
  .description('Transform a file or the clipboard buffer')
  .argument('<prompt>', 'The task you wish for the assistant to complete')
  .argument('[file]', 'the file to refactor, omit this to pull from clipboard')
  .action((file, options) => {
    if (file) {
      // Read file
    } else {
      // load clipboard into history
    }
    throw new Error('Not yet implemented')
  })

program
  .command('think')
  .description('Think about a query and answer the user')
  .argument('[prompt]', 'The task you wish for the assistant to complete')
  .argument('[file]')
  .option('--speak')
  .action(async (prompt, file, { speak, ...options }) => {
    const goblin = await Goblin.fromOptions({ ...program.opts(), ...options })
    // TODO: Handle file
    const content = prompt || await collect(process.stdin)
    const answer = await goblin.query(content)
    console.log(answer)
    if (speak) {
      await speakTool({ message: answer })
    }
  })

program
  .command('chat')
  .description('Have a conversation via the TUI')
  .action(repl)

await program.parseAsync(process.argv)

/**
 * @param {object} options
 */
async function repl (options) {
  const goblin = await Goblin.fromOptions({ ...program.opts(), ...options })

  const rl = readline.createInterface({ input, output })

  /**
   * @type {import('./index.js').Message[]}
   */
  const history = []

  /**
   * @param {string} message
   */
  function onprogress (message) {
    console.log(message)
  }

  while (true) {
    try {
      const question = await rl.question('> ')
      const response = await goblin.query(question, { history, onprogress })
      console.log(response)
      // TODO: Persist previous questions somewhere?
      history.push({
        role: USER,
        content: question
      }, {
        role: ASSISTANT,
        content: response
      })
    } catch (e) {
      if (e.name === 'AbortError') return
      throw e
    }
  }
}

/**
 * Collect all the data in a stream into a single blob of text.
 * Use this to get all the text out of STDIN
 * @param {AsyncIterable<Buffer>} stream
 * @returns
 */
async function collect (stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  const combined = Buffer.concat(chunks).toString('utf8')

  return combined
}
