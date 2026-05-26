// Augment NextAuth's Session type so our app code can read role + emailVerified
// off session.user without TypeScript complaints.
import type { DefaultSession } from 'next-auth'
import type { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      emailVerified: Date | null
    } & DefaultSession['user']
  }
}
