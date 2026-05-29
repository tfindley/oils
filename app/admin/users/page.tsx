import { prisma } from '@/lib/prisma'
import { Stat } from '@/components/ui/Stat'
import { AdminUsersList } from './AdminUsersList'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Users — Admin' }

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      lastSignInAt: true,
      purgeExempt: true,
      purgeWarningSentAt: true,
      purgeFinalWarningSentAt: true,
      _count: { select: { blends: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Top-of-page summary stats — always-visible basic admin context.
  const total = users.length
  const adminCount = users.filter((u) => u.role === 'ADMIN').length
  const verifiedCount = users.filter((u) => u.emailVerified).length
  const exemptCount = users.filter((u) => u.purgeExempt).length
  const warnedCount = users.filter((u) => u.purgeWarningSentAt).length
  const totalBlends = users.reduce((s, u) => s + u._count.blends, 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">Users</h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total" value={total} />
        <Stat label="Admins" value={adminCount} />
        <Stat label="Verified" value={verifiedCount} />
        <Stat label="Purge-exempt" value={exemptCount} />
        <Stat label="Warned" value={warnedCount} tone={warnedCount > 0 ? 'amber' : 'default'} />
        <Stat label="Total blends" value={totalBlends} />
      </div>

      <AdminUsersList users={users.map((u) => ({
        ...u,
        emailVerified: u.emailVerified ? u.emailVerified.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
        lastSignInAt: u.lastSignInAt ? u.lastSignInAt.toISOString() : null,
        purgeWarningSentAt: u.purgeWarningSentAt ? u.purgeWarningSentAt.toISOString() : null,
        purgeFinalWarningSentAt: u.purgeFinalWarningSentAt ? u.purgeFinalWarningSentAt.toISOString() : null,
      }))} />
    </div>
  )
}
