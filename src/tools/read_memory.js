export const name = 'read_memory'
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

export default async function read_memory ({ tags }, agent) {
  const facts = await agent.memory.recall({ tags, limit: 8 })
  return facts.map(({ fact, tags, timestamp }) => ({
    fact,
    tags,
    timestamp: new Date(timestamp)
  }))
}
