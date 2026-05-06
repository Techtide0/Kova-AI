import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages } = (await req.json()) as {
    messages: { role: 'user' | 'assistant'; content: string }[]
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages required' }, { status: 400 })
  }

  const isValidMsg = (m: unknown): m is { role: 'user' | 'assistant'; content: string } =>
    typeof m === 'object' &&
    m !== null &&
    ((m as { role?: unknown }).role === 'user' || (m as { role?: unknown }).role === 'assistant') &&
    typeof (m as { content?: unknown }).content === 'string'

  if (!messages.every(isValidMsg)) {
    return Response.json({ error: 'invalid message format' }, { status: 400 })
  }

  const userId = session.user.id
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [streams, recentTxs] = await Promise.all([
    prisma.incomeStream.findMany({
      where: { userId, isActive: true },
      include: {
        transactions: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    }),
    prisma.transaction.findMany({
      where: { userId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { incomeStream: { select: { name: true } } },
    }),
  ])

  const streamContext =
    streams.length > 0
      ? streams
          .map((s) => {
            const txs = s.transactions
            const revenue = txs
              .filter((t) => t.type === 'CREDIT')
              .reduce((sum, t) => sum + Number(t.amount), 0)
            const expenses = txs
              .filter((t) => t.type === 'DEBIT')
              .reduce((sum, t) => sum + Number(t.amount), 0)
            const mRevenue = txs
              .filter((t) => t.type === 'CREDIT' && t.createdAt >= monthStart)
              .reduce((sum, t) => sum + Number(t.amount), 0)
            return `- ${s.name} (${s.kind}): all-time revenue ₦${revenue.toLocaleString()}, expenses ₦${expenses.toLocaleString()}, profit ₦${(revenue - expenses).toLocaleString()}, this month ₦${mRevenue.toLocaleString()}`
          })
          .join('\n')
      : 'No income streams set up yet.'

  const recentTxContext =
    recentTxs.length > 0
      ? recentTxs
          .map(
            (t) =>
              `- ${t.createdAt.toLocaleDateString('en-NG')}: ${t.type} ₦${Number(t.amount).toLocaleString()} on ${t.incomeStream?.name ?? 'unknown'} (${t.categoryLabel ?? 'uncategorized'})`
          )
          .join('\n')
      : 'No recent transactions.'

  const systemPrompt = `You are Kova, a personal AI financial advisor for a Nigerian side-hustler. You have access to their real financial data.

Current date: ${now.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Currency: Nigerian Naira (₦)

## Income Streams (all-time stats):
${streamContext}

## Recent Transactions:
${recentTxContext}

Rules:
- Be direct, warm, and practical — like a smart friend who happens to be a CFO
- Always ground answers in the actual data above
- If data is insufficient to answer confidently, say so honestly
- Format numbers with ₦ and comma separators
- Keep responses concise — 2–4 paragraphs max unless a breakdown is clearly needed
- Never invent data that is not present in the context above`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      send({ type: 'tool', message: 'Reading your financial data…' })

      try {
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages,
          stream: true,
        })

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            send({ type: 'token', content: event.delta.text })
          }
        }

        send({ type: 'done' })
      } catch (err) {
        console.error('[chat] Anthropic error:', err)
        send({ type: 'error', message: 'Something went wrong — please try again.' })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}
