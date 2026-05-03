import Anthropic from '@anthropic-ai/sdk'

interface CategoriseInput {
  source: string
  direction: 'INFLOW' | 'OUTFLOW'
  amountKobo: number
  description: string
  counterpartyName?: string
  streamName: string
}

interface CategoriseResult {
  categoryLabel: string
  categoryConfidence: number
  aiReasoning: string
}

// Fixed taxonomy Claude must choose from.
const CATEGORIES = [
  'revenue',
  'stock_purchase',
  'logistics',
  'marketing',
  'tools_subscriptions',
  'personal_withdrawal',
  'supplier_payment',
  'utilities',
  'food',
  'transport',
  'gifts_remittance',
  'other',
] as const

const SYSTEM_PROMPT = `You are a financial transaction categoriser for Nigerian small business owners.
Given a transaction's details, pick exactly one category from this list:
${CATEGORIES.join(', ')}

Respond with JSON only — no explanation outside the JSON:
{ "category": "<one of the above>", "confidence": <0.0-1.0>, "reasoning": "<one sentence>" }`

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

export async function categorise(input: CategoriseInput): Promise<CategoriseResult> {
  // Squad virtual account inflows are deterministically revenue — no AI needed.
  if (input.source === 'SQUAD_VA' && input.direction === 'INFLOW') {
    return {
      categoryLabel: 'revenue',
      categoryConfidence: 1.0,
      aiReasoning: `Inflow into ${input.streamName}'s dedicated virtual account`,
    }
  }

  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          direction: input.direction,
          amountNaira: (input.amountKobo / 100).toFixed(2),
          description: input.description,
          counterparty: input.counterpartyName ?? 'unknown',
          stream: input.streamName,
        }),
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const parsed = JSON.parse(text) as {
      category: string
      confidence: number
      reasoning: string
    }
    return {
      categoryLabel: CATEGORIES.includes(parsed.category as (typeof CATEGORIES)[number])
        ? parsed.category
        : 'other',
      categoryConfidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
      aiReasoning: parsed.reasoning ?? '',
    }
  } catch {
    return { categoryLabel: 'other', categoryConfidence: 0.5, aiReasoning: text.slice(0, 200) }
  }
}
