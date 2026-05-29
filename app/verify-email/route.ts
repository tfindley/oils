import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Validates an email-verification token and marks the User verified.
// On success: redirect to /login with a flag so the page can show a friendly
// "email verified, sign in to continue" message.
// On failure: redirect to /login with an error flag.
//
// We deliberately do NOT auto-sign-in here — Auth.js v5 doesn't expose a clean
// public helper for "create a session bypassing credentials," and forcing the
// user to enter their password once after verifying is reasonable security
// hygiene (someone with stolen access to a recovery email but not the password
// shouldn't get a free login).

const TOKEN_RE = /^[a-f0-9]{64}$/i

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  const fail = (reason: string) => {
    const u = new URL('/login', url.origin)
    u.searchParams.set('error', reason)
    return NextResponse.redirect(u)
  }

  if (!token || !TOKEN_RE.test(token)) return fail('invalid-token')

  const record = await prisma.verificationToken.findUnique({ where: { token } })
  if (!record) return fail('invalid-token')
  if (record.purpose !== 'EMAIL_VERIFY') return fail('invalid-token')
  if (record.expires < new Date()) {
    // Best-effort cleanup; ignore failure.
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {})
    return fail('expired-token')
  }

  // Verify the user, then drop the token.
  await prisma.$transaction([
    prisma.user.update({
      where: { email: record.identifier },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { token } }),
  ])

  // Note: only `verified=1` — the email address is intentionally NOT included
  // in the redirect URL to keep it out of browser history and Referer headers
  // on outbound clicks from the login page.
  const successUrl = new URL('/login', url.origin)
  successUrl.searchParams.set('verified', '1')
  return NextResponse.redirect(successUrl)
}
