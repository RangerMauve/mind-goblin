#!/usr/bin/env node
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import { program } from 'commander'

import { USER, ASSISTANT, Goblin } from './index.js'

program
  .name('mind-goblin')
  .description('Your local ai assistant.')
  .option('-s, --system <type>', 'Custom system prompt for the assistant', 'You are a local assistant named Mind Goblin.')
  .option('--debug', 'output extra debug info to inspect the train of thought')

program
  .command('refactor')
  .description('Refactor a file or the clipboard buffer')
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
  .argument('<prompt>', 'The task you wish for the assistant to complete')
  .argument('[file]')
  .action(async (prompt, file, options) => {
    const goblin = await Goblin.fromOptions({ ...program.opts(), ...options })
    // TODO: Handle file
    const answer = await goblin.query(prompt)
    console.log(answer)
  })

program
  .command('repl')
  .description('Have a conversation via the TUI')
  .action(repl)

await program.parseAsync(process.argv)

async function repl (options) {
  const goblin = await Goblin.fromOptions({ ...program.opts(), ...options })

  const rl = readline.createInterface({ input, output })

  const history = []

  while (true) {
    const question = await rl.question('> ')
    const response = await goblin.query(question, history)
    console.log(response)
    // TODO: Persist previous questions somewhere?
    history.push({
      role: USER,
      content: question
    }, {
      role: ASSISTANT,
      content: response
    })
  }
}
