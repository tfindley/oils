'use server'

import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail, passwordResetEmail } from '@/lib/email'

const RESET_TOKEN_TTL_MS = 60 * 60_000 // 1h

export type ForgotResult = { ok: true } | { ok: false; error: string }

export async function forgotPasswordAction(_prev: ForgotResult | null, formData: FormData): Promise<ForgotResult> {
  const parsed = z.object({ email: z.string().email().max(254) }).safeParse({ email: formData.get('email') })
  if (!parsed.success) return { ok: false, error: 'Enter a valid email.' }

  const email = parsed.data.email.toLowerCase()
  const rl = rateLimit(`password-reset:${email}`, 3, 24 * 60 * 60_000) // 3/day/email
  // Even on rate-limit, return success — don't leak that rate limit applied to a real account.
  if (!rl.ok) return { ok: true }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } })
  // Same response shape whether or not user exists.
  if (!user) return { ok: true }

  const token = randomBytes(32).toString('hex')
  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token,
      expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      purpose: 'PASSWORD_RESET',
    },
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const resetUrl = `${baseUrl}/reset-password?token=${token}`

  try {
    await sendEmail(passwordResetEmail({ to: user.email, resetUrl }))
  } catch (err) {
    console.error('[forgot-password] email send failed', err)
  }

  return { ok: true }
}
