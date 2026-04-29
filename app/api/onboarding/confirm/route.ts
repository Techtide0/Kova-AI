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
          // mobileNumber, dob, address, gender are required by Squad but not captured at signup.
          // In production these must come from the user's profile.
          mobileNumber: '08000000000',
          dob: '01/01/1990',
          address: '1 Kova Street, Lagos',
          gender: '1',
          beneficiaryAccount: '0123456789',
          bvn: '22222222222',
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
    throw error
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
