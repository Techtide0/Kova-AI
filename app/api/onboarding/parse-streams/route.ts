import { auth } from '@/auth'
import { anthropic } from '@/lib/anthropic'
import type { ParsedStream } from '@/lib/onboarding/types'
import { z } from 'zod'

const requestSchema = z.object({
  rawInput: z.string().min(3, 'Please describe what you do to earn money'),
})

const SYSTEM_PROMPT = `You are a financial assistant helping Nigerian side-hustlers set up their Kova account.

Your job is to parse a user's free-text description of how they earn money into a structured list of income streams.

Rules:
- Split combined descriptions into individual streams ("I sell ankara and tutor maths" → two streams)
- SALARY: any employment income — salary, wages, NYSC allowance, civil service income
- BUSINESS: everything else — trading, freelance, content creation, tutoring, reselling, farming, etc.
- Generate friendly, capitalized stream names (not the raw user words verbatim)
- Keep category to a single lowercase word
- If the user lists the same activity twice, merge them into one stream
- Do not invent streams the user did not mention`

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
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

  let streams: ParsedStream[]
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'parse_income_streams',
          description: 'Parse the user input into structured income streams',
          input_schema: {
            type: 'object' as const,
            properties: {
              streams: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Short, human-friendly stream name, e.g. "Ankara Sales"',
                    },
                    kind: {
                      type: 'string',
                      enum: ['BUSINESS', 'SALARY'],
                      description: 'SALARY for employment income, BUSINESS for everything else',
                    },
                    category: {
                      type: 'string',
                      description: 'Single lowercase word, e.g. "retail", "tutoring", "employment"',
                    },
                  },
                  required: ['name', 'kind', 'category'],
                },
              },
            },
            required: ['streams'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'parse_income_streams' },
      messages: [{ role: 'user', content: parsed.data.rawInput }],
    })

    const toolUse = response.content.find((block) => block.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Model did not call the parse tool')
    }

    streams = (toolUse.input as { streams: ParsedStream[] }).streams
  } catch (err) {
    console.error('[parse-streams] Anthropic error:', err)
    return Response.json({ error: 'AI service unavailable, please try again' }, { status: 503 })
  }

  return Response.json({ streams })
}
