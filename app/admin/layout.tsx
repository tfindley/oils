import { isAdminAuthenticated } from '@/lib/admin-auth'
import { AdminNav } from './AdminNav'

// Server-side auth gate for the admin chrome. AdminNav is only rendered when
// the request is actually authenticated as admin (role-based session OR a
// valid legacy cookie that's currently allowed). proxy.ts already blocks
// unauthed access to /admin/* (except /admin/login); this is defence-in-depth
// at the layout level so the admin nav links can't leak even if a code path
// bypassed the proxy redirect.

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await isAdminAuthenticated()

  return (
    <>
      {isAdmin && <AdminNav />}
      {children}
    </>
  )
}
