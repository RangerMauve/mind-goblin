export const USER = 'user'
export const SYSTEM = 'system'
export const ASSISTANT = 'assistant'
const STOP = ['<|end|>',
  '<|user|>',
  '<|assistant|>',
  '<|im_end|>',
  'Reference(s)',
  '<|im_end>',
  '<|im_continuation|>',
  '<|im_start'
]

const PRE_GENERATE = `\n<|${ASSISTANT}|>\n`

export const DEFAULT_MODEL = 'phi3'

export function serialize (messages) {
  return messages
    .map(message)
    .join('\n')
}

function message ({ role, content }) {
  return `<|${role}|>\n${content}<|end|>`
}

export async function generate (messages) {
  const prompt = serialize(messages) + PRE_GENERATE

  return genAnswerOllama(prompt)
}

export async function genAnswerOllama (prompt, { images = [], model = 'phi3:instruct' } = {}) {
  if (images.length && model.startsWith('phi3')) {
    model = 'llava-phi3'
  }

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      model,
      images,
      prompt,
      stream: false,
      raw: true,
      options: {
        stop: STOP,
        // num_predict: 1024,
        // top_p: 0.9,
        // top_k: 20,
        temperature: 0.3
      }
    })
  })
  if (!response.ok) {
    throw new Error(await response.text())
  }
  const { response: content } = await response.json()

  return content
}

export async function genAnswerLamaCpp (prompt) {
  // console.log({prompt})
  const response = await fetch('http://127.0.0.1:8080/completion', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      stop: STOP,
      n_predict: 1024,
      temperature: 0.8,
      top_p: 0.9
    })
  })
  if (!response.ok) {
    throw new Error(await response.text())
  }
  const { content } = await response.json()

  return content
}
