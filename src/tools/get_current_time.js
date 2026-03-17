export const name = 'get_current_time'
export const description = 'Get the current time. Only use this if the user asks about time. This function has no additional arguments'
export const parameters = { type: 'object' }

/**
 * Get the current time.
 * @returns string
 */
export default function getCurrentTime () {
  return getCurrentTimeAndDate()
}

function getCurrentTimeAndDate () {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0') // getMonth() is zero-in>
  const day = String(now.getDate()).padStart(2, '0')

  const timeAndDate = `${hours}:${minutes}:${seconds} ${year}/${month}/${day}`
  return timeAndDate
}
