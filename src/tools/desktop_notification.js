import notifier from 'node-notifier'

export const name = 'desktop_notification'
export const description = 'Show a notification message on the user\'s desktop. Use this only when the user asks for it.'
export const parameters = {
  type: 'object',
  properties: {
    message: {
      type: 'string'
    }
  },
  required: ['message']
}

/**
 *
 * @param {object} parameters
 * @param {string} parameters.message
 * @returns {Promise<string>}
 */
export default async function notify ({ message }) {
  // TODO: Allow title/icon?
  await new Promise((resolve, reject) => {
    notifier.notify({
      title: 'Mind Goblin',
      message
    }, (err) => {
      if (err) reject(err)
      else resolve(null)
    })
  })

  return 'Notification sent to desktop.'
}
