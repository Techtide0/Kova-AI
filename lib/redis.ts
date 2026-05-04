import { Redis } from 'ioredis'

// Singleton for producers (queue enqueue, pub/sub publish).
// Reused across Next.js hot-reloads in development.
const globalForRedis = global as unknown as { redis: Redis }

function createRedis(): Redis {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is not set')
  const r = new Redis(process.env.REDIS_URL)
  r.on('error', (err) => console.error('[redis] Connection error:', err.message))
  return r
}

export const redis = globalForRedis.redis ?? createRedis()

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}

// Each SSE connection needs its own subscriber instance — a Redis connection
// in subscribe mode can't be reused for anything else.
export function createSubscriber(): Redis {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is not set')
  const sub = new Redis(process.env.REDIS_URL)
  sub.on('error', (err) => console.error('[redis:subscriber] Connection error:', err.message))
  return sub
}
