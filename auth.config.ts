import type { NextAuthConfig } from 'next-auth'

// Edge-safe config — no Prisma, no Node.js-only imports.
// Used by both the middleware (proxy.ts) and the full auth instance (auth.ts).
export const authConfig: NextAuthConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
  providers: [],
}
