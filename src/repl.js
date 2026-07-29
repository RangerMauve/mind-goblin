import readline from 'node:readline/promises'
import path from 'node:path'
import fs from 'node:fs/promises'
import { stdin as input, stdout as output } from 'node:process'

import { program } from 'commander'

import { USER, ASSISTANT, Goblin } from './index.js'
import { sessionFolder } from './utils.js'
import { Sessions } from './sessions.js'

/**
 * @param {object} options
 * @param {boolean} [options.showThinking]
 * @param {string} [options.session] Name of the session to resume/save
 */
export async function repl ({ showThinking, session, ...options }) {
  const sessions = new Sessions(sessionFolder)
  const slug = sessions.slug(session)

  /**
   * @type {import('./index.js').Message[]}
   */
  const messages = session ? await sessions.load(slug) : []
  const history = messages.filter(({ role }) => role === USER).map(({ content }) => content)

  const goblin = await Goblin.fromOptions({ ...program.opts(), ...options })

  const rl = readline.createInterface({
    input,
    output,
    history,
    completer
  })

  /**
   * @param {string} message
   */
  function onprogress (message) {
    console.log('\x1b[90m%s\x1b[0m', message)
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

  const onthinking = showThinking ? onprogress : undefined

  while (true) {
    try {
      const question = await rl.question('> ')
      const response = await goblin.query(question, { history: messages, onprogress, onbeforetool, onthinking })
      console.log(response)
      process.stdout.write('\x07')
      // TODO: Persist previous questions somewhere?
      messages.push({
        role: USER,
        content: question
      }, {
        role: ASSISTANT,
        content: response
      })
      await sessions.save(slug, messages)
    } catch (e) {
      if (e.name === 'AbortError') return
      throw e
    }
  }
}
