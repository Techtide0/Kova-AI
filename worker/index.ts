/**
 * Kova background worker — runs as a separate process on Railway.
 *
 * Consumes jobs from the BullMQ "inflows" queue and processes payment events
 * from Squad webhooks.
 *
 * Run locally:
 *   pnpm worker:dev
 *
 * On Railway: add a Worker service with start command `pnpm worker:start`.
 * Point it at the same repo and give it the same env vars as the web service.
 */
import 'dotenv/config'
import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { processInflow } from './jobs/process-inflow'
import type { InflowJobData } from '../lib/queue'

if (!process.env.REDIS_URL) {
  console.error('✖ REDIS_URL is not set')
  process.exit(1)
}

// BullMQ workers require maxRetriesPerRequest: null on the IORedis connection.
const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })

const worker = new Worker<InflowJobData>(
  'inflows',
  async (job) => {
    if (job.name === 'processInflow') {
      await processInflow(job.data)
    } else {
      console.warn(`[worker] Unknown job type: ${job.name}`)
    }
  },
  { connection }
)

worker.on('completed', (job) => {
  console.log(`[worker] ✔ Job ${job.id} (${job.name}) completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] ✖ Job ${job?.id} (${job?.name}) failed: ${err.message}`)
})

worker.on('error', (err) => {
  console.error('[worker] Worker error:', err.message)
})

console.log('[worker] Started — listening for inflow jobs on queue "inflows"…')
