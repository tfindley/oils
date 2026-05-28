import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { verify as argon2Verify } from '@node-rs/argon2'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// In dev (or during `next build`), fall back to a stable dummy secret so the
// auth module loads. In real production runtime we fail fast — the build phase
// sets NEXT_PHASE='phase-production-build', so we only throw outside that.
if (!process.env.AUTH_SECRET) {
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
  if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
    throw new Error('AUTH_SECRET is required in production. Generate one with: openssl rand -base64 32')
  }
  process.env.AUTH_SECRET = 'dev-only-secret-do-not-use-in-production'
}

// Auth.js v5 setup. Database sessions (revocable, server-trusted) over JWT
// because we want admin/sessions visible in /admin/users (v1.3+) and
// invalidation on password change without a JWT-blacklist mess.
//
// Credentials provider for email+password. OAuth providers come in v1.3.0.

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Auth.js v5 requires JWT sessions when using the Credentials provider.
  // We still create Account rows for OAuth provider linking (v1.3.0) but
  // sessions themselves live in the signed JWT cookie, not the Session table.
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    verifyRequest: '/login?check=email',
  },
  providers: [
    Credentials({
      name: 'Email + password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const parsed = CredentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          select: { id: true, email: true, name: true, image: true, role: true, passwordHash: true, emailVerified: true },
        })

        // Same response shape for missing-user and bad-password to avoid
        // user enumeration. Don't leak which one failed.
        if (!user || !user.passwordHash) return null

        const ok = await argon2Verify(user.passwordHash, parsed.data.password)
        if (!ok) return null

        // Unverified users can sign in but should be redirected to a "please
        // verify" page by the caller. Auth.js's database sessions don't care
        // about emailVerified by default; we surface it on the session and
        // gate elsewhere.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    // On sign-in, copy id/role/emailVerified from the User row into the JWT.
    // The Credentials authorize() returns `id`; OAuth providers set it too.
    jwt: async ({ token, user, trigger }) => {
      // On sign-in (user object present) OR on explicit update, refresh from DB.
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, role: true, emailVerified: true, name: true, email: true, image: true },
        })
        if (dbUser) {
          token.sub = dbUser.id
          token.role = dbUser.role
          token.emailVerified = dbUser.emailVerified ? dbUser.emailVerified.toISOString() : null
          token.name = dbUser.name
          token.email = dbUser.email
          token.picture = dbUser.image
        }
      } else if (trigger === 'update' && token.sub) {
        // Picked up by useSession().update() after profile edits.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, emailVerified: true, name: true, image: true },
        })
        if (dbUser) {
          token.role = dbUser.role
          token.emailVerified = dbUser.emailVerified ? dbUser.emailVerified.toISOString() : null
          token.name = dbUser.name
          token.picture = dbUser.image
        }
      }
      return token
    },
    // Surface id/role/emailVerified on the session object that pages and
    // components see via auth().
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = (token.sub as string | undefined) ?? session.user.id
        session.user.role = (token.role as 'USER' | 'ADMIN' | undefined) ?? 'USER'
        session.user.emailVerified =
          typeof token.emailVerified === 'string' ? new Date(token.emailVerified) : null
      }
      return session
    },
  },
  trustHost: true, // we always run behind a trusted reverse proxy in production
})
