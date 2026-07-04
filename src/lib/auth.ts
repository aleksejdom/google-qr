import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/db'

// Fallback, falls AUTH_SECRET nicht gesetzt ist: stabiles Secret aus der
// DATABASE_URL ableiten (verlaesst den Server nie). Fuer Produktion trotzdem
// ein eigenes AUTH_SECRET setzen.
const authSecret =
  process.env.AUTH_SECRET ??
  crypto
    .createHash('sha256')
    .update(`reviewpilot-auth:${process.env.DATABASE_URL ?? 'dev'}`)
    .digest('base64')

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Selbst gehostet hinter Reverse-Proxy (Coolify/Traefik): Host-Header vertrauen
  trustHost: true,
  secret: authSecret,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'E-Mail', type: 'email' },
        password: { label: 'Passwort', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').toLowerCase().trim()
        const password = String(credentials?.password ?? '')
        if (!email || !password) return null

        const user = await prisma.user.findUnique({
          where: { email },
          include: { memberships: { include: { org: true }, take: 1 } },
        })
        if (!user) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        const membership = user.memberships[0]
        if (!membership) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          orgId: membership.orgId,
          orgName: membership.org.name,
          role: membership.role,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.orgId = user.orgId
        token.orgName = user.orgName
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.orgId = token.orgId as string
      session.user.orgName = token.orgName as string
      session.user.role = token.role as string
      return session
    },
  },
})
