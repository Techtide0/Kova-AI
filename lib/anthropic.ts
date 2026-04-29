import Anthropic from '@anthropic-ai/sdk'

// Reuse across hot-reloads in development, same pattern as lib/prisma.ts
const globalForAnthropic = global as unknown as { anthropic: Anthropic }

function createClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

export const anthropic = globalForAnthropic.anthropic ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForAnthropic.anthropic = anthropic
}
