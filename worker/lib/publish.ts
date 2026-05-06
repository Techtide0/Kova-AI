import { Redis } from 'ioredis'

// Separate connection from the BullMQ worker — publishing doesn't conflict
// with job consumption, but it's cleaner to keep them separate.
let publisher: Redis | null = null

function getPublisher(): Redis {
  if (!publisher) {
    if (!process.env.REDIS_URL) throw new Error('REDIS_URL is not set')
    publisher = new Redis(process.env.REDIS_URL)
    publisher.on('error', (err) =>
      console.error('[redis:publisher] Connection error:', err.message)
    )
  }
  return publisher
}

export async function publishToUser(userId: string, payload: unknown): Promise<void> {
  await getPublisher().publish(`user:${userId}`, JSON.stringify(payload))
}
