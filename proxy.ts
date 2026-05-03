import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

// Lightweight auth instance — no Prisma, safe for the edge middleware runtime.
// The full auth instance (auth.ts) is used in server components and API routes.
const { auth } = NextAuth(authConfig)
export { auth as proxy }

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|register|api/auth).*)'],
}
