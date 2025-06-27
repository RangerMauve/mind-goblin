import { execa } from 'execa'

export const name = 'speak'
export const description = 'Speak a message out loud through the speaker.'
export const parameters = {
  type: 'object',
  properties: {
    message: {
      type: 'string'
    }
  },
  required: ['message']
}

export default async function speak ({ message }) {
  await execa`spd-say ${message.replaceAll('\n', ' ')}`
}
