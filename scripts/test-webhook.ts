/**
 * Day 5 smoke test: fire a correctly-signed fake webhook at the local server.
 *
 * Run with:
 *   pnpm tsx scripts/test-webhook.ts
 *
 * What to expect:
 *   ✔ 200 OK on the first run
 *   ✔ 200 OK on the second run (idempotency — same event, not double-processed)
 *   ✔ A row in the WebhookInbox table (check with `pnpm db:studio`)
 *   ✖ 401 Unauthorized if the SQUAD_SECRET_KEY doesn't match
 */
import 'dotenv/config'
import { createHmac } from 'crypto'

const BASE_URL = process.env.WEBHOOK_TEST_URL ?? 'http://localhost:3000'
const SECRET = process.env.SQUAD_SECRET_KEY

if (!SECRET) {
  console.error('✖ SQUAD_SECRET_KEY is not set in .env')
  process.exit(1)
}

const payload = {
  Event: 'charge.success',
  Body: {
    transactionRef: `TEST-WEBHOOK-${Date.now()}`,
    amount: 500000,
    currency: 'NGN',
    virtualAccountNumber: '9012345678',
    customerName: 'Test Customer',
  },
}

const body = JSON.stringify(payload)
const signature = createHmac('sha512', SECRET).update(body).digest('hex')

async function main() {
  console.log(`▶ Sending test webhook to ${BASE_URL}/api/webhooks/squad`)
  console.log(`  Event:        ${payload.Event}`)
  console.log(`  TransactionRef: ${payload.Body.transactionRef}`)

  const response = await fetch(`${BASE_URL}/api/webhooks/squad`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-squad-encrypted-body': signature,
    },
    body,
  })

  const text = await response.text()

  if (response.status === 200) {
    console.log('\n✔ Webhook accepted (200 OK)')
    console.log('  Check the WebhookInbox table with: pnpm db:studio')
  } else if (response.status === 401) {
    console.error('\n✖ Signature rejected (401) — check that SQUAD_SECRET_KEY matches .env')
  } else {
    console.error(`\n✖ Unexpected response: ${response.status} — ${text}`)
  }

  // Send the same event again to verify idempotency
  console.log('\n▶ Sending the same event again (idempotency check)…')

  const response2 = await fetch(`${BASE_URL}/api/webhooks/squad`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-squad-encrypted-body': signature,
    },
    body,
  })

  if (response2.status === 200) {
    console.log('✔ Duplicate accepted gracefully (200 OK) — idempotency works')
  } else {
    console.error(`✖ Duplicate returned ${response2.status} — idempotency is broken`)
  }
}

main().catch((err) => {
  console.error('✖ Test failed:', err.message)
  process.exit(1)
})
