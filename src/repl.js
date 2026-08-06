import readline from 'node:readline/promises'
import { emitKeypressEvents } from 'node:readline'
import path from 'node:path'
import fs from 'node:fs/promises'
import { stdin as input, stdout as output } from 'node:process'

import { program } from 'commander'

import { USER, Goblin } from './index.js'
import { sessionFolder, conf } from './utils.js'
import { makeCancelSignalResource } from './cancel.js'
import { Sessions } from './sessions.js'

const ALLOWED_COMMANDS = [
  // Common utilities for controling the machine
  'bluetoothctl', 'upower', 'mpc',
  // Info about the machine
  'ls ', 'cat ', 'pwd', 'whoami', 'hostname', 'date', 'uname',
  // File system and shell status
  'echo ', 'head ', 'tail ', 'grep ', 'find ', 'stat ', 'df ',
  'ps ', 'id ', 'env', 'printenv', 'wc ', 'which '
]

const DANGEROUS_PATTERNS = [
  '&', '${', '|'
]

const SHELL_JOINERS = /\s*(?:&&|\|\||&|\|)\s*/

/**
 * @param {object} options
 * @param {boolean} [options.showThinking]
 * @param {string} [options.session] Name of the session to resume/save
 * @param {boolean} [options.clear] Clear session before starting
 */
export async function repl (options) {
  const { showThinking, session, clear, ...goblinOpts } = { ...conf, ...options }
  const sessions = new Sessions(sessionFolder)
  const slug = sessions.slug(session)

  /**
   * @type {import('./index.js').Message[]}
   */
  const messages = session && !clear ? await sessions.load(slug) : []
  const history = messages.filter(({ role }) => role === USER).map(({ content }) => content)
  // Make most recent messages first
  history.reverse()

  const goblin = await Goblin.fromOptions({ ...program.opts(), ...goblinOpts })

  const rl = readline.createInterface({
    input,
    output,
    history,
    completer
  })
  emitKeypressEvents(input)

  rl.once('close', () => process.exit(0))

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
    const controller = new AbortController()

    /**
     * @param {string} str
     * @param {{ name: string }} key
     */
    const onKeypress = (str, key) => {
      if (key && key.name === 'escape') {
        controller.abort()
      }
    }

    input.on('keypress', onKeypress)

    try {
      const answer = await rl.question(`${prompt}\n> Y/n (ESC to cancel)\x07 `, { signal: controller.signal })
      if (answer.trim().toLowerCase() === 'n') {
        console.log('Cancelling.')
        throw new Error('Tool call cancelled by user. Stop what youre doing and ask for clarification.')
      }
    } catch (e) {
      console.log('Cancelling')
      throw new Error('Tool call cancelled by user. Stop what youre doing and ask for clarification.')
    } finally {
      input.removeListener('keypress', onKeypress)
    }
  }

  /**
   * @param {string} name
   * @param {object} args
   */
  async function onbeforetool (name, args) {
    if (name === 'read_file') {
      console.log('\x1b[92mReading file: %s\x1b[0m', args.path)
    }
    if (name === 'read_directory') {
      console.log('\x1b[92mReading directory: %s\x1b[0m', args.path)
    }
    if (name === 'shell_command') {
      // @ts-expect-error TODO cast args to expected shape
      const command = args.command
      if (shouldConfirm(command)) {
        await confirm(`Allow shell command?\n${command}`)
      }
      // Allow some commands through without confirming
    }
    if (name === 'write_file') {
      // @ts-expect-error TODO cast args to expected shape
      await confirm(`Allow write to ${args.path}?\nContent:\n${args.content}`)
    }
    if (name === 'edit_file') {
      // @ts-expect-error TODO cast args to expected shape
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
      const content = await rl.question('> ')
      messages.push({ role: USER, content })
      await goblin.crank(messages, {
      	onprogress,
      	onbeforetool,
      	onthinking,
      	listenForCancel: () => makeCancelSignalResource(input)
      })
      const response = messages.at(-1)
      // TODO: render formatted as markdown
      console.log(response.content)
      process.stdout.write('\x07')
      await sessions.save(slug, messages)
    } catch (e) {
      if (e.name === 'AbortError') continue
      throw e
    }
  }
}

/**
 * @param {string} command
 * @returns {boolean}
 */
function shouldConfirm (command) {
  if (command.includes('\n')) return true

  // Strip out common patterns
  const stripped = command
    .trim()
    .replaceAll('2>&1', '')
    .replaceAll('2>/dev/null', '')

  // Check subcommands if it's a compound expression
  if (hasDangerousPatterns(stripped)) {
    return !stripped.split(SHELL_JOINERS)
      .every((subcommand) => isAllowed(subcommand.trim()))
  }
  return !isAllowed(stripped)
}

/**
 * @param {string} command
 * @returns {boolean}
 */
function isAllowed (command) {
  return ALLOWED_COMMANDS.some(cmd => command.startsWith(cmd))
}

/**
 * @param {string} command
 * @returns {boolean}
 */
function hasDangerousPatterns (command) {
  return DANGEROUS_PATTERNS.some(pattern => command.includes(pattern))
}
