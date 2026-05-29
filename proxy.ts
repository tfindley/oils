import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/admin-auth'
import { auth } from '@/auth'
import { getSettings } from '@/lib/settings'

// Proxy responsibilities (v1.4.x):
//
//   1. Maintenance-mode gate (Settings.maintenanceMode === true)
//      Rewrites all public requests to /maintenance; returns 503 JSON for /api/*.
//      Exempt: /admin/*, /maintenance, /api/auth/*, /api/cron/*, static assets.
//
//   2. Admin access gate (/admin/*) — three valid paths:
//      • User-based: session.user.role === 'ADMIN'
//      • Legacy admin_token cookie when Settings.legacyAdminEnabled === true
//        OR FORCE_LEGACY_ADMIN_LOGIN=1
//      • /admin/login itself (form is hidden by the page when legacy is off)
//
// Next.js 16 proxies always run on the Node.js runtime, which gives us
// direct Prisma access for the Settings lookup.

const ADMIN_PATH_RE = /^\/admin(\/|$)/

// Paths that bypass the maintenance gate. /admin/* is the operator's escape
// hatch; /api/auth (NextAuth handlers) and /api/cron (bearer-auth'd jobs)
// keep working so the site doesn't fully freeze.
function isMaintenanceExempt(pathname: string): boolean {
  if (pathname === '/maintenance') return true
  if (ADMIN_PATH_RE.test(pathname)) return true
  if (pathname.startsWith('/api/auth')) return true
  if (pathname.startsWith('/api/cron')) return true
  return false
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // --- Stage 1: maintenance gate ---
  if (!isMaintenanceExempt(pathname)) {
    const settings = await getSettings().catch(() => null)
    if (settings?.maintenanceMode === true) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Site is in maintenance mode.' },
          { status: 503, headers: { 'Retry-After': '300' } },
        )
      }
      const url = req.nextUrl.clone()
      url.pathname = '/maintenance'
      // Rewrite (not redirect) keeps the original URL in the address bar so
      // the user can refresh to retry when maintenance ends.
      return NextResponse.rewrite(url)
    }
  }

  // --- Stage 2: admin gate (only for /admin/* paths) ---
  if (!ADMIN_PATH_RE.test(pathname)) return

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
    // Fail-closed: require an explicit true. If settings lookup fails (null),
    // do NOT re-open the legacy path during a DB outage.
    const legacyAllowed = forceLegacy || settings?.legacyAdminEnabled === true

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

// Matcher exempts Next.js internals and common static assets. Anything that
// reaches the proxy still goes through both gates above.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|icon\\.png|apple-icon\\.png).*)',
  ],
}
