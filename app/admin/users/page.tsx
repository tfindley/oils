import { prisma } from '@/lib/prisma'
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
      _count: { select: { blends: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">Users</h1>
      </div>
      <AdminUsersList users={users.map((u) => ({
        ...u,
        emailVerified: u.emailVerified ? u.emailVerified.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
      }))} />
    </div>
  )
}
