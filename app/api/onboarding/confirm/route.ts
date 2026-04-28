import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createVirtualAccount, SquadError } from '@/lib/squad/client'
import type { ConfirmableStream, CreatedStream } from '@/lib/onboarding/types'
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
// Falls back gracefully for single-word names.
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '.',
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id || !session.user.name || !session.user.email) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { streams } = parsed.data

  // Extract session values into locals — TypeScript loses narrowing inside async callbacks.
  const userId = session.user.id
  const userEmail = session.user.email
  const { firstName, lastName } = splitName(session.user.name)

  let createdStreams: CreatedStream[]

  try {
    createdStreams = await prisma.$transaction(async (tx) => {
      const results: CreatedStream[] = []

      for (const stream of streams as ConfirmableStream[]) {
        const incomeStream = await tx.incomeStream.create({
          data: {
            userId,
            name: stream.name,
            kind: stream.kind,
            category: stream.category,
          },
        })

        if (stream.kind === 'BUSINESS') {
          // customerIdentifier must be globally unique in Squad — we use the
          // stream's DB id so each account maps 1-to-1 with our records.
          const squadAccount = await createVirtualAccount({
            customerIdentifier: incomeStream.id,
            firstName,
            lastName,
            // mobileNumber is required by Squad but not captured at signup.
            // In production this should come from the user's profile.
            // The sandbox accepts any 11-digit Nigerian number format.
            mobileNumber: '08000000000',
            email: userEmail,
          })

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
            kind: stream.kind,
            category: stream.category,
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
            kind: stream.kind,
            category: stream.category,
          })
        }
      }

      return results
    })
  } catch (error) {
    if (error instanceof SquadError) {
      return Response.json(
        { error: `Could not create virtual account: ${error.message}` },
        { status: 502 }
      )
    }
    throw error
  }

  return Response.json({ streams: createdStreams }, { status: 201 })
}
