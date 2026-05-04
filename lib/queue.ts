import { Queue } from 'bullmq'
import { redis } from './redis'

export interface InflowJobData {
  inboxId: string // WebhookInbox.id — worker fetches full payload from DB
  eventId: string // Squad transactionRef — for logging
}

export const inflowsQueue = new Queue<InflowJobData>('inflows', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})
