export const name = 'log'
export const description = 'Output your final response to the user.'
export const parameters = {
  type: 'object',
  properties: {
    message: {
      type: 'string'
    }
  },
  required: ['message']
}

export default function log ({ message }) {
  console.log('Assistant:', message)
}
