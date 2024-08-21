import { Tools } from '../tools.js'
import { Agent } from './index.js'

export const DEFAULT_SYSTEM_PROMPT = 'I am an advanced AI assistant.'

export class Goblin extends Agent {
  static async default () {
    const tools = await Tools.default()

    return new Goblin(DEFAULT_SYSTEM_PROMPT, tools)
  }

  static async fromOptions ({ systemPrompt = DEFAULT_SYSTEM_PROMPT, debug = false }) {
    const tools = await Tools.default()
    const goblin = new Goblin(systemPrompt, tools)
    if (debug) {
      goblin.debug = true
    }

    return goblin
  }
}
