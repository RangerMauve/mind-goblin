export const name = 'readMemory'
export const description = 'Read facts from memory.'
export const parameters = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Tags related to the fact. e.g. "preferences", "instructions", "reminder". Leave this empty to get all facts'
    }
  }
}

export default async function speak ({ tags }, agent) {
  const facts = await agent.memory.recall({ tags, limit: 8 })
  return facts.map(({fact, tags, timestamp}) => ({fact, tags, timestamp: new Date(timestamp)}))
}
