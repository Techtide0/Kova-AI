/**
 * Day 3 integration test: create one virtual account against Squad sandbox.
 * Updated on Day 4 to use the per-stream VirtualAccount schema.
 *
 * Run with:
 *   pnpm tsx scripts/test-squad.ts
 *
 * Requires SQUAD_SECRET_KEY and DATABASE_URL in .env.
 * Run `pnpm db:seed` first so the test user and streams exist.
 */
import 'dotenv/config'
import { createVirtualAccount } from '../lib/squad/client'
import { prisma } from '../lib/prisma'

async function main() {
  console.log('▶ Creating virtual account on Squad sandbox…')

  const result = await createVirtualAccount({
    customerIdentifier: 'test-tola-001',
    firstName: 'Tola',
    lastName: 'Adeyemi',
    mobileNumber: '08012345678',
    email: 'tola@kova.ai',
  })

  console.log('✔ Squad response:', result)

  // Persist to an existing seed stream so we can verify the DB write.
  const stream = await prisma.incomeStream.findFirst({
    where: { user: { email: 'tola@kova.ai' } },
  })
  if (!stream) {
    console.error('✖ Seed stream not found — run `pnpm db:seed` first')
    process.exit(1)
  }

  const saved = await prisma.virtualAccount.upsert({
    where: { streamId: stream.id },
    update: {
      accountNumber: result.accountNumber,
      accountName: result.accountName,
      bankName: result.bankName,
      squadReference: result.squadReference,
    },
    create: {
      streamId: stream.id,
      squadReference: result.squadReference,
      accountNumber: result.accountNumber,
      accountName: result.accountName,
      bankName: result.bankName,
    },
  })

  console.log('✔ Saved to database:', {
    accountNumber: saved.accountNumber,
    bankName: saved.bankName,
  })

  console.log('\nDay 3 test passed ✓')
}

main()
  .catch((err) => {
    console.error('✖ Test failed:', err.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
