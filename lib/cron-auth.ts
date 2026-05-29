import { NextRequest, NextResponse } from 'next/server'

// Verify an `Authorization: Bearer <CRON_SECRET>` header in constant time.
// Returns null if the request is authorized; otherwise returns a NextResponse
// (500 if CRON_SECRET isn't set, 401 if the header doesn't match) that the
// route handler should return directly.
//
// Used by every /api/cron/* route to keep the auth shape identical across
// jobs — see app/api/cron/purge/route.ts, app/api/cron/account-purge/route.ts.

export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const enc = new TextEncoder()
  const a = enc.encode(auth)
  const b = enc.encode(expected)
  let diff = a.length !== b.length ? 1 : 0
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  if (diff !== 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
