#!/usr/bin/env node
import readline from 'node:readline/promises'
import path from 'node:path'
import fs from 'node:fs/promises'
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

  const rl = readline.createInterface({
    input,
    output,
    completer
  })

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

  /**
   * @param {string} prompt
   */
  async function confirm (prompt) {
    const answer = await rl.question(`${prompt}\n> y/N\x07 `)
    if (answer.trim().toLowerCase() !== 'y') {
      throw new Error('Tool call cancelled by user. Ask for clarification.')
    }
  }

  /**
   * @param {string} name
   * @param {object} args
   */
  async function onbeforetool (name, args) {
    if (name === 'shell_command') {
      await confirm(`Allow shell command?\n${args.command}`)
    }
    if (name === 'write_file') {
      await confirm(`Allow write to ${args.path}?\nContent:\n${args.content}`)
    }
    if (name === 'edit_file') {
      await confirm(`Allow edit to ${args.path}?\nReplace:\n${args.old_text}\nWith:\n${args.new_text}`)
    }
  }

  /**
   * @param {string} line
   */
  async function completer (line) {
    const parts = line.split(' ')
    const lastPart = parts[parts.length - 1]
    // Only add the trailing space if there's more than one part
    // Else we should leave the first part blank
    const trailingSpace = (parts.length > 1 ? ' ' : '')
    const firstPart = parts.slice(0, -1).join(' ') + trailingSpace

    if (!lastPart.startsWith('./') && !lastPart.startsWith('/')) {
      return [[], line]
    }

    try {
      const isFolder = lastPart.endsWith('/')
      const fullPath = path.join(process.cwd(), lastPart)

      const dir = isFolder ? fullPath : path.dirname(fullPath)
      const base = isFolder ? '' : path.basename(fullPath).toLowerCase()
      // Only add the last part's base name if it isn't a folder
      const prefix = firstPart + (isFolder ? lastPart : lastPart.slice(0, -base.length))

      // Get the fils and folders from the dir
      const files = await fs.readdir(dir, { withFileTypes: true })
      // Case insensitive match
      const matches = files.filter(f => f.name.toLowerCase().startsWith(base))

      // Add the trailing slash if it's a folder to trigger further completions
      const completed = matches.map(m => prefix + m.name + (m.isDirectory() ? '/' : ''))
      // console.log({lastPart, firstPart, dir, base, prefix, completed})
      return [completed, line]
    } catch (e) {
      console.error(e)
      return [[], line]
    }
  }

  while (true) {
    try {
      const question = await rl.question('> ')
      const response = await goblin.query(question, { history, onprogress, onbeforetool })
      console.log(response)
      process.stdout.write("\x07");
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
