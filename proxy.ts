import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/admin-auth'
import { auth } from '@/auth'
import { getSettings } from '@/lib/settings'

// Admin access gate. Three valid paths to /admin/* in v1.2.1+:
//
//   1. User-based: session.user.role === 'ADMIN' (always accepted).
//      This is the path we want everyone on by v2.0.0.
//
//   2. Legacy admin_token cookie (HMAC-signed) when allowed:
//      • Settings.legacyAdminEnabled === true  (default; admin can disable
//        from /admin/settings once a User-role-ADMIN exists), OR
//      • FORCE_LEGACY_ADMIN_LOGIN=1 in the environment (emergency override —
//        recover when user-based access is lost).
//
//   3. No auth at all only on /admin/login itself.
//
// Note: Next.js 16 proxies always run on the Node.js runtime, which gives
// us direct Prisma access for the Settings lookup.

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // /admin/login is the only /admin/* path that's accessible without auth
  // — but the page itself will 404 if legacy is disabled (see app/admin/login).
  if (pathname === '/admin/login') return

  // Path 1: User-based admin
  const session = await auth().catch(() => null)
  if (session?.user?.role === 'ADMIN') return

  // Path 2: Legacy cookie, gated by Settings + env override
  const secret = process.env.ADMIN_SECRET
  if (secret) {
    const settings = await getSettings().catch(() => null)
    const forceLegacy = process.env.FORCE_LEGACY_ADMIN_LOGIN === '1'
    const legacyAllowed = forceLegacy || settings?.legacyAdminEnabled !== false

    if (legacyAllowed) {
      const token = req.cookies.get('admin_token')?.value
      if (await verifySessionToken(token, secret).catch(() => false)) return
    }
  }

  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/admin/login'
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*'],
}
