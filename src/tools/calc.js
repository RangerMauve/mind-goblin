export const name = 'calc'
export const description = 'Run a calculation. Always use this for math like multiplication or currency conversion.'
export const parameters = {
  type: 'object',
  properties: {
    expression: {
      type: 'string',
      description: 'A math expression to evaluate. For example "4 * 4". Only usethis for math.'
    }
  },
  required: ['expression']
}

/**
 * @param {object} parameters
 * @param {string} parameters.expression
 * @returns {number}
 */
export default function calc ({ expression }) {
  // TODO: make this more secure 😈
  const fn = new Function('return ' + expression)
  return fn()
}
