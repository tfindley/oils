'use server'

import { z } from 'zod'
import { hash as argon2Hash } from '@node-rs/argon2'
import { prisma } from '@/lib/prisma'

export type ResetResult = { ok: true } | { ok: false; error: string }

const TOKEN_RE = /^[a-f0-9]{64}$/i

const ResetSchema = z.object({
  token: z.string().regex(TOKEN_RE),
  password: z.string().min(8).max(128),
})

export async function resetPasswordAction(_prev: ResetResult | null, formData: FormData): Promise<ResetResult> {
  const parsed = ResetSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { ok: false, error: 'Invalid token or password (min 8 characters).' }

  const record = await prisma.verificationToken.findUnique({ where: { token: parsed.data.token } })
  if (!record || record.purpose !== 'PASSWORD_RESET' || record.expires < new Date()) {
    if (record) {
      await prisma.verificationToken.delete({ where: { token: parsed.data.token } }).catch(() => {})
    }
    return { ok: false, error: 'That reset link is invalid or has expired. Request a new one.' }
  }

  const passwordHash = await argon2Hash(parsed.data.password)

  await prisma.$transaction([
    prisma.user.update({
      where: { email: record.identifier },
      data: {
        passwordHash,
        // Marking the email verified on password reset is intentional —
        // they proved control of the inbox by clicking the reset link.
        emailVerified: new Date(),
      },
    }),
    prisma.verificationToken.delete({ where: { token: parsed.data.token } }),
  ])

  // Note: with JWT sessions (required by Auth.js v5 Credentials provider),
  // existing session cookies on other devices remain valid until they expire.
  // Proper "kick all sessions on password change" needs a passwordVersion
  // column + JWT-callback check; deferred to a follow-up if/when it matters.

  return { ok: true }
}
