import { prisma } from '../../lib/prisma'
import type { InflowJobData } from '../../lib/queue'
import { categorise } from '../lib/categorise'
import { publishToUser } from '../lib/publish'

// Squad charge.success Body fields we rely on.
interface SquadChargeBody {
  virtualAccountNumber?: string
  amount?: number // kobo
  transactionRef?: string
  customerName?: string
}

export async function processInflow({ inboxId, eventId }: InflowJobData): Promise<void> {
  const inbox = await prisma.webhookInbox.findUnique({ where: { id: inboxId } })

  if (!inbox) {
    console.warn(`[processInflow] Inbox row ${inboxId} not found — skipping`)
    return
  }
  if (inbox.processed) {
    console.log(`[processInflow] Event ${eventId} already processed — skipping`)
    return
  }

  const payload = inbox.payload as { Event?: string; Body?: SquadChargeBody }
  const body = payload.Body ?? {}

  const accountNumber = body.virtualAccountNumber
  if (!accountNumber) {
    console.warn(`[processInflow] No virtualAccountNumber in payload for event ${eventId}`)
    await prisma.webhookInbox.update({ where: { id: inboxId }, data: { processed: true } })
    return
  }

  const va = await prisma.virtualAccount.findUnique({
    where: { accountNumber },
    include: { stream: true },
  })

  if (!va) {
    console.warn(`[processInflow] No VirtualAccount for number ${accountNumber}`)
    await prisma.webhookInbox.update({ where: { id: inboxId }, data: { processed: true } })
    return
  }

  const amountKobo = body.amount
  if (!amountKobo || amountKobo <= 0) {
    console.warn(`[processInflow] Invalid or missing amount (${amountKobo}) for event ${eventId}`)
    await prisma.webhookInbox.update({ where: { id: inboxId }, data: { processed: true } })
    return
  }
  const amountNaira = amountKobo / 100

  const { categoryLabel, categoryConfidence, aiReasoning } = await categorise({
    source: 'SQUAD_VA',
    direction: 'INFLOW',
    amountKobo,
    description: body.transactionRef ?? '',
    counterpartyName: body.customerName,
    streamName: va.stream.name,
  })

  // Write transaction + smart-feed entry + mark inbox processed atomically.
  // The sourceRef unique constraint is the final dedup guard against TOCTOU races
  // where two workers both pass the inbox.processed check before either commits.
  type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

  let transaction
  try {
    transaction = await prisma.$transaction(
      async (tx: Tx) => {
        const t = await tx.transaction.create({
          data: {
            userId: va.stream.userId,
            incomeStreamId: va.streamId,
            virtualAccountId: va.id,
            type: 'CREDIT',
            amount: amountNaira,
            currency: 'NGN',
            description: body.transactionRef,
            status: 'COMPLETED',
            sourceRef: eventId,
            counterpartyName: body.customerName,
            categoryLabel,
            categoryConfidence,
            aiReasoning,
          },
        })

        await tx.aIAction.create({
          data: {
            userId: va.stream.userId,
            type: 'CATEGORIZE_TRANSACTION',
            prompt: `Categorized inflow of ₦${amountNaira.toLocaleString('en-NG')} into ${va.stream.name}`,
            result: { transactionId: t.id, categoryLabel, categoryConfidence, aiReasoning },
            status: 'COMPLETED',
          },
        })

        await tx.webhookInbox.update({ where: { id: inboxId }, data: { processed: true } })

        return t
      },
      { maxWait: 10000, timeout: 20000 }
    )
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      console.log(`[processInflow] Duplicate transaction for event ${eventId} — skipping`)
      return
    }
    throw error
  }

  if (!transaction) return

  // Push live update to the user's dashboard via Redis pub/sub.
  await publishToUser(va.stream.userId, {
    kind: 'transaction.created',
    transaction: {
      id: transaction.id,
      amount: amountNaira,
      currency: 'NGN',
      description: transaction.description,
      streamName: va.stream.name,
      categoryLabel,
      aiReasoning,
      createdAt: transaction.createdAt.toISOString(),
    },
  })

  console.log(
    `[processInflow] ✔ tx ${transaction.id} | ₦${amountNaira} | ${va.stream.name} | ${categoryLabel}`
  )
}

function isPrismaUniqueError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  )
}
