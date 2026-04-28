/**
 * Day 3 integration test: create one virtual account against Squad sandbox.
 *
 * Run with:
 *   pnpm tsx scripts/test-squad.ts
 *
 * Requires SQUAD_SECRET_KEY and DATABASE_URL in .env
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

  // Persist to database
  const user = await prisma.user.findUnique({ where: { email: 'tola@kova.ai' } })
  if (!user) {
    console.error('✖ Seed user not found — run `pnpm db:seed` first')
    process.exit(1)
  }

  const saved = await prisma.virtualAccount.upsert({
    where: { userId: user.id },
    update: {
      accountNumber: result.accountNumber,
      bankName: result.bankName,
    },
    create: {
      userId: user.id,
      accountNumber: result.accountNumber,
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
