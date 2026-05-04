import { prisma } from '@/lib/prisma'
import { inflowsQueue } from '@/lib/queue'
import { verifySquadSignature, extractEventId } from '@/lib/squad/webhook'
import type { SquadWebhookEvent } from '@/lib/squad/webhook'

// Prisma error code for unique constraint violations
const PRISMA_UNIQUE_CONSTRAINT = 'P2002'

export async function POST(request: Request) {
  // Read the raw body first — we need it as a string for signature verification.
  // Calling request.json() beforehand consumes the stream and breaks the HMAC.
  const rawBody = await request.text()
  const signature = request.headers.get('x-squad-encrypted-body')

  if (!verifySquadSignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 })
  }

  // JSON.parse returns `any` — we leave it untyped so Prisma can store it in the
  // JSON column without a cast. We project the typed view only for our logic below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawEvent: any
  try {
    rawEvent = JSON.parse(rawBody)
  } catch {
    return new Response('Payload must be valid JSON', { status: 400 })
  }

  const event = rawEvent as SquadWebhookEvent
  const eventId = extractEventId(event)
  if (!eventId) {
    return new Response('Could not extract a stable event ID from payload', { status: 400 })
  }

  let inboxId: string
  try {
    const inbox = await prisma.webhookInbox.create({
      data: { eventId, provider: 'SQUAD', payload: rawEvent },
    })
    inboxId = inbox.id
  } catch (error: unknown) {
    // Duplicate eventId — Squad is retrying an event we already received.
    // Return 200 so Squad stops retrying — idempotent by design.
    if (isPrismaUniqueError(error)) {
      return new Response('OK', { status: 200 })
    }
    throw error
  }

  // Enqueue background processing — returns immediately, worker does the heavy lifting.
  await inflowsQueue.add('processInflow', { inboxId, eventId })

  return new Response('OK', { status: 200 })
}

function isPrismaUniqueError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === PRISMA_UNIQUE_CONSTRAINT
  )
}
