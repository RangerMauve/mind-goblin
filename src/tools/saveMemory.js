export const name = 'saveMemory'
export const description = 'Save facts to your memory to retrieve later. Use this when told to remember something for later.'
export const parameters = {
  type: 'object',
  properties: {
    fact: {
      type: 'string',
      description: 'A fact to remember for later.'
    },
    tags: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Tags related to the fact. e.g. "preferences", "instructions", "reminders"'
    }
  },
  required: ['fact']
}

export default async function saveMemory ({ fact, tags = [] }, agent) {
  await agent.memory.remember(fact, tags)
  return 'Saved fact for later'
}
