import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createVirtualAccount, SquadError } from '@/lib/squad/client'
import type { ConfirmableStream, CreatedStream } from '@/lib/onboarding/types'
import type { VirtualAccountResult } from '@/lib/squad/types'
import { z } from 'zod'

const streamSchema = z.object({
  name: z.string().min(1, 'Stream name is required'),
  kind: z.enum(['BUSINESS', 'SALARY']),
  category: z.string().min(1, 'Category is required'),
})

const requestSchema = z.object({
  streams: z
    .array(streamSchema)
    .min(1, 'At least one income stream is required')
    .max(10, 'Maximum 10 income streams allowed'),
})

// Splits "Tola Adeyemi" → { firstName: "Tola", lastName: "Adeyemi" }.
// Guards against empty or whitespace-only names.
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: 'User', lastName: '.' }
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '.',
  }
}

type PreparedStream = {
  input: ConfirmableStream
  squadAccount?: VirtualAccountResult
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id || !session.user.name || !session.user.email) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const userId = session.user.id
  const userEmail = session.user.email
  const { firstName, lastName } = splitName(session.user.name)

  // These fields are required by Squad but are not yet collected in the signup flow.
  // In production, they must come from the user's profile — this route must not go
  // live until profile collection is built (Week 3). The env vars let us override the
  // sandbox defaults in staging without touching source code.
  if (process.env.NODE_ENV === 'production') {
    return Response.json(
      {
        error:
          'Onboarding confirm is not available in production yet — user profile collection required',
      },
      { status: 501 }
    )
  }

  const sandboxMobile = process.env.SQUAD_SANDBOX_MOBILE
  const sandboxDob = process.env.SQUAD_SANDBOX_DOB
  const sandboxAddress = process.env.SQUAD_SANDBOX_ADDRESS
  const rawGender = process.env.SQUAD_SANDBOX_GENDER ?? '1'
  const sandboxGender: '1' | '2' = rawGender === '2' ? '2' : '1'
  const sandboxBeneficiaryAccount = process.env.SQUAD_SANDBOX_BENEFICIARY_ACCOUNT
  const sandboxBvn = process.env.SQUAD_SANDBOX_BVN

  if (
    !sandboxMobile ||
    !sandboxDob ||
    !sandboxAddress ||
    !sandboxBeneficiaryAccount ||
    !sandboxBvn
  ) {
    return Response.json(
      {
        error:
          'Sandbox Squad env vars are not configured — set SQUAD_SANDBOX_MOBILE, SQUAD_SANDBOX_DOB, SQUAD_SANDBOX_ADDRESS, SQUAD_SANDBOX_BENEFICIARY_ACCOUNT, and SQUAD_SANDBOX_BVN in .env.local',
      },
      { status: 503 }
    )
  }

  // Phase 1 — Call Squad for every BUSINESS stream before touching the database.
  // If Squad is down or rejects a request, we bail here and nothing is written to DB.
  // This avoids the data-inconsistency risk of external API calls inside a transaction.
  const prepared: PreparedStream[] = []

  try {
    for (const stream of parsed.data.streams as ConfirmableStream[]) {
      if (stream.kind === 'BUSINESS') {
        const squadAccount = await createVirtualAccount({
          // Stream id isn't available yet, so use a deterministic key from user+name.
          // In production this should be idempotency-key aware.
          customerIdentifier: `${userId}-${stream.name.toLowerCase().replace(/\s+/g, '-')}`,
          firstName,
          lastName,
          mobileNumber: sandboxMobile,
          dob: sandboxDob,
          address: sandboxAddress,
          gender: sandboxGender,
          beneficiaryAccount: sandboxBeneficiaryAccount,
          bvn: sandboxBvn,
          email: userEmail,
        })
        prepared.push({ input: stream, squadAccount })
      } else {
        prepared.push({ input: stream })
      }
    }
  } catch (error) {
    if (error instanceof SquadError) {
      return Response.json(
        { error: `Could not create virtual account: ${error.message}` },
        { status: 502 }
      )
    }
    console.error('[onboarding/confirm] Unexpected error during virtual account creation')
    return Response.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }

  // Phase 2 — All Squad calls succeeded. Write everything to the database atomically.
  // If this transaction rolls back, the Squad accounts are orphaned — acceptable for
  // sandbox since Squad sandbox has no cost per account.
  // maxWait/timeout are raised above Prisma's 2s/5s defaults to handle Railway's latency.
  const createdStreams = await prisma.$transaction(
    async (tx) => {
      const results: CreatedStream[] = []

      for (const { input, squadAccount } of prepared) {
        const incomeStream = await tx.incomeStream.create({
          data: {
            userId,
            name: input.name,
            kind: input.kind,
            category: input.category,
          },
        })

        if (squadAccount) {
          await tx.virtualAccount.create({
            data: {
              streamId: incomeStream.id,
              squadReference: squadAccount.squadReference,
              accountNumber: squadAccount.accountNumber,
              accountName: squadAccount.accountName,
              bankName: squadAccount.bankName,
            },
          })

          results.push({
            id: incomeStream.id,
            name: incomeStream.name,
            kind: input.kind,
            category: input.category,
            virtualAccount: {
              accountNumber: squadAccount.accountNumber,
              accountName: squadAccount.accountName,
              bankName: squadAccount.bankName,
            },
          })
        } else {
          results.push({
            id: incomeStream.id,
            name: incomeStream.name,
            kind: input.kind,
            category: input.category,
          })
        }
      }

      return results
    },
    { maxWait: 10000, timeout: 20000 }
  )

  return Response.json({ streams: createdStreams }, { status: 201 })
}
