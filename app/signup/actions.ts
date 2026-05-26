'use server'

import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { hash as argon2Hash } from '@node-rs/argon2'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail, verificationEmail } from '@/lib/email'

const SignupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
})

export type SignupResult =
  | { ok: true }
  | { ok: false; error: string }

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24h

export async function signupAction(_prev: SignupResult | null, formData: FormData): Promise<SignupResult> {
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`signup:${ip}`, 3, 60 * 60_000) // 3/hour/IP
  if (!rl.ok) return { ok: false, error: 'Too many signups from this address. Try again later.' }

  const parsed = SignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name') || undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: 'Check your email and password (min 8 characters).' }
  }
  const { email, password, name } = parsed.data
  const normalisedEmail = email.toLowerCase()

  // Don't leak existence — return the same success-ish "check your email"
  // response whether or not the email is taken. Real signups proceed; collisions
  // are silently dropped (the existing user gets nothing, but they wouldn't
  // expect to anyway).
  const existing = await prisma.user.findUnique({ where: { email: normalisedEmail }, select: { id: true } })
  if (existing) return { ok: true }

  const passwordHash = await argon2Hash(password)
  const user = await prisma.user.create({
    data: { email: normalisedEmail, passwordHash, name: name ?? null },
    select: { id: true, email: true },
  })

  const token = randomBytes(32).toString('hex')
  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token,
      expires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      purpose: 'EMAIL_VERIFY',
    },
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`

  try {
    await sendEmail(verificationEmail({ to: user.email, verifyUrl }))
  } catch (err) {
    console.error('[signup] email send failed', err)
    // Still report success — the user can request a re-send from the
    // /login?check=email page. Don't expose internal failure to the user.
  }

  return { ok: true }
}
