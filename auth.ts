import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, name: true, email: true, passwordHash: true },
        })

        if (!user?.passwordHash) return null

        const passwordValid = await compare(parsed.data.password, user.passwordHash)
        if (!passwordValid) return null

        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],

  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
  },

  callbacks: {
    jwt({ token, user }) {
      // On sign-in, persist the user id into the token
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      // Expose the user id on the client-side session object
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
})
