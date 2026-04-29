import { auth } from '@/auth'
import { googleAI } from '@/lib/google-ai'
import { SchemaType } from '@google/generative-ai'
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

  const model = googleAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          streams: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: {
                  type: SchemaType.STRING,
                  description: 'Short, human-friendly stream name, e.g. "Ankara Sales"',
                },
                kind: {
                  type: SchemaType.STRING,
                  format: 'enum' as const,
                  enum: ['BUSINESS', 'SALARY'],
                  description: 'SALARY for employment income, BUSINESS for everything else',
                },
                category: {
                  type: SchemaType.STRING,
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
    systemInstruction: SYSTEM_PROMPT,
  })

  let aiResult: Awaited<ReturnType<typeof model.generateContent>>
  try {
    aiResult = await model.generateContent(parsed.data.rawInput)
  } catch {
    return Response.json({ error: 'AI service unavailable, please try again' }, { status: 503 })
  }

  let streams: ParsedStream[]
  try {
    const data = JSON.parse(aiResult.response.text()) as { streams: ParsedStream[] }
    streams = data.streams
  } catch {
    return Response.json(
      { error: 'AI returned an unexpected response, please try again' },
      { status: 502 }
    )
  }

  return Response.json({ streams })
}
