import { GoogleGenerativeAI } from '@google/generative-ai'

// Reuse across hot-reloads in development, same pattern as lib/prisma.ts
const globalForGoogleAI = global as unknown as { googleAI: GoogleGenerativeAI }

function createClient(): GoogleGenerativeAI {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY environment variable is not set')
  }
  return new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
}

export const googleAI = globalForGoogleAI.googleAI ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForGoogleAI.googleAI = googleAI
}
