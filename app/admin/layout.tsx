import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { verifySessionToken } from '@/lib/admin-auth'
import { getSettings } from '@/lib/settings'
import { AdminNav } from './AdminNav'

// Server-side auth gate for the admin chrome. AdminNav is only rendered when
// the request is actually authenticated as admin (role-based session OR a
// valid legacy cookie that's currently allowed).
//
// proxy.ts already blocks unauthed access to /admin/* (except /admin/login),
// so this check is defence-in-depth: even if a code path ever bypassed the
// proxy redirect, the layout still wouldn't leak the admin nav links.

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await isAdminAuthenticated()

  return (
    <>
      {isAdmin && <AdminNav />}
      {children}
    </>
  )
}

async function isAdminAuthenticated(): Promise<boolean> {
  // Path 1: user-based ADMIN role
  const session = await auth().catch(() => null)
  if (session?.user?.role === 'ADMIN') return true

  // Path 2: legacy cookie (when allowed)
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false

  const settings = await getSettings().catch(() => null)
  const forceLegacy = process.env.FORCE_LEGACY_ADMIN_LOGIN === '1'
  const legacyAllowed = forceLegacy || settings?.legacyAdminEnabled !== false
  if (!legacyAllowed) return false

  const jar = await cookies()
  const token = jar.get('admin_token')?.value
  return verifySessionToken(token, secret).catch(() => false)
}
