import ollama from 'ollama'

import { access, constants } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const model = 'mindgoblin'
const modelfile = resolvePath('./goblin.Modelfile')
const modelURL = 'https://huggingface.co/dagbs/fc-dolphin-2.6-mistral-7b-dpo-laser-GGUF/resolve/main/fc-dolphin-2.6-mistral-7b-dpo-laser.Q4_K_M.gguf?download=true'
const modelLocation = './model.gguf'

const FUNCTIONS = {
  search_wikipedia: searchWikipedia
}
const CALL = '<functioncall>'

const rl = readline.createInterface({ input, output })

await autoInit()

while (true) {
  const question = await rl.question('> ')
  const response = await query(question)
  console.log(response)
}

async function query (prompt) {
  const messages = [{
    role: 'user',
    content: prompt
  }]
  let answer = (await genAnswer(messages)).trim()

  while (answer.startsWith(CALL)) {
    const description = answer
      .slice(CALL.length)
      .replace(': \'{', ': {')
      .replace('}\'', '}')
    const { name, arguments: args } = JSON.parse(description)
    console.log(`(( calling ${name}${JSON.stringify(args)} ))`)

    const response = await FUNCTIONS[name](args)

    messages.push({
      role: 'assistant',
      content: `${answer} FUNCTION RESPONSE: ${JSON.stringify(response)}`
    })

    const final = await genAnswer(messages)

    answer = final.trim()
  }

  return answer
}

function makeConvo (messages) {
  return messages
    .map(({ role, content }) => `<|im_start|>${role}\n${content}<|im_end|>`).join('\n')
}

async function genAnswer (messages) {
  const prompt = makeConvo(messages)
  // console.log({prompt})
  const { response } = await ollama.generate({
    model,
    prompt
  })

  return response
}

async function searchWikipedia ({ query }) {
  const url = new URL('https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&limit=3')
  url.searchParams.set('srsearch', query)
  const response = await fetch(url.href)
  try {
    const results = await response.json()
    const snippets = results.query.search.map(({ snippet }) => snippet)
    return snippets
  } catch (e) {
    return e.message
  }
}

// Check ilf
async function autoDownload () {
  try {
    await access(modelLocation, constants.R_OK)
    console.log('Model already loaded')
  } catch {
    const response = await fetch(modelURL)
    if (!response.ok) {
      throw new Error(await response.text())
    }
    console.log('Saving model to disk')
    const writable = createWriteStream(modelLocation)
    const readable = await Readable.fromWeb(response.body)
    await pipeline(readable, writable)
  }
}

async function autoInit () {
  try {
    await ollama.show({ model })
  } catch {
    console.log('Model not set up, initializing')
    await autoDownload()
    console.log('Creating model in ollama')
    await ollama.create({
      model,
      path: modelfile
    })
  }
}
