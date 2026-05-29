import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { signOut, auth } from '@/auth'

export async function GET() {
  // Clear both auth paths so the link works for legacy-cookie admins AND
  // user-based ADMIN-role sessions. If only admin_token was cleared, a
  // role=ADMIN viewer would land on /admin/login → redirect-back-to-/admin loop.
  const jar = await cookies()
  jar.delete('admin_token')

  const session = await auth().catch(() => null)
  if (session?.user) {
    await signOut({ redirectTo: '/admin/login' })
    return
  }

  redirect('/admin/login')
}
