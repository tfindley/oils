'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { rateLimit } from '@/lib/rate-limit'
import { mintSessionToken } from '@/lib/admin-auth'
import { getSettings } from '@/lib/settings'

export async function adminLogin(_prev: unknown, data: FormData): Promise<{ error: string } | never> {
  // Reject if legacy login is disabled — protect against direct POSTs even
  // though the page itself 404s. Fail-closed when settings lookup fails so a
  // DB blip doesn't re-enable the legacy path.
  const settings = await getSettings().catch(() => null)
  const forceLegacy = process.env.FORCE_LEGACY_ADMIN_LOGIN === '1'
  const legacyAllowed = forceLegacy || settings?.legacyAdminEnabled === true
  if (!legacyAllowed) {
    return { error: 'Legacy admin login is disabled.' }
  }

  const secret = process.env.ADMIN_SECRET
  const input = data.get('secret')?.toString() ?? ''

  // Without ADMIN_SECRET set there is no legacy login path. proxy.ts only
  // accepts ADMIN-role sessions in that case, so reject directly here too.
  if (!secret) {
    return { error: 'Legacy admin login is not configured.' }
  }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const rl = rateLimit(`login:${ip}`, 5, 60_000)
  if (!rl.ok) {
    console.warn(`[admin-login] rate-limited ip=${ip} ts=${new Date().toISOString()}`)
    return { error: 'Too many attempts. Try again in a minute.' }
  }

  // Constant-time comparison
  const enc = new TextEncoder()
  const a = enc.encode(input.padEnd(128, '\0').slice(0, 128))
  const b = enc.encode(secret.padEnd(128, '\0').slice(0, 128))
  let diff = input.length !== secret.length ? 1 : 0
  for (let i = 0; i < 128; i++) diff |= a[i] ^ b[i]

  if (diff !== 0) {
    console.warn(`[admin-login] failed ip=${ip} ts=${new Date().toISOString()}`)
    return { error: 'Incorrect secret.' }
  }

  const jar = await cookies()
  jar.set('admin_token', await mintSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  redirect('/admin')
}
