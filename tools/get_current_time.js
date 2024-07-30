export const name = 'get_current_time'
export const description = 'Get the current time. Only use this if the user asks about time. This function has no additional arguments'
export const parameters = { type: 'object' }

export default function getCurrentTime () {
  return new Date().toString()
}
