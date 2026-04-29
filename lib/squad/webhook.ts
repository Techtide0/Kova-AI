import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verifies that an inbound webhook actually came from Squad.
 *
 * Squad signs every webhook with HMAC-SHA512 over the raw request body,
 * using your SQUAD_SECRET_KEY, and sends the hex digest in the
 * `x-squad-encrypted-body` header.
 *
 * We use timingSafeEqual so an attacker can't infer how many characters
 * matched by measuring how long our comparison takes.
 */
export function verifySquadSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false

  const secret = process.env.SQUAD_SECRET_KEY
  if (!secret) throw new Error('SQUAD_SECRET_KEY is not set')

  const computed = createHmac('sha512', secret).update(rawBody).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    // timingSafeEqual throws if the two buffers have different byte lengths,
    // which means they cannot be equal.
    return false
  }
}

// ── Payload shape ─────────────────────────────────────────────────────────────
// Squad sends all webhook events in this envelope. The Body shape varies by
// Event type — charge.success, transfer.success, etc. We only type the fields
// we need at the inbox layer; Week 2 workers type the specific Body shapes.

export interface SquadWebhookEvent {
  Event: string
  Body: {
    transactionRef?: string
    id?: string | number
    [key: string]: unknown
  }
}

/**
 * Extracts a stable dedup key from a Squad webhook event.
 * transactionRef is present on every charge and transfer event.
 * Falls back to stringifying the id field for any edge-case event types.
 */
export function extractEventId(event: SquadWebhookEvent): string | null {
  if (event.Body?.transactionRef) return event.Body.transactionRef
  if (event.Body?.id != null) return String(event.Body.id)
  return null
}
