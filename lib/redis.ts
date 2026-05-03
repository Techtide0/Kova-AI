import { Redis } from 'ioredis'

// Singleton for producers (queue enqueue, pub/sub publish).
// Reused across Next.js hot-reloads in development.
const globalForRedis = global as unknown as { redis: Redis }

function createRedis(): Redis {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is not set')
  return new Redis(process.env.REDIS_URL)
}

export const redis = globalForRedis.redis ?? createRedis()

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}

// Each SSE connection needs its own subscriber instance — a Redis connection
// in subscribe mode can't be reused for anything else.
export function createSubscriber(): Redis {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is not set')
  return new Redis(process.env.REDIS_URL)
}
