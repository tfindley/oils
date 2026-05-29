import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/Badge'
import { AdminBlendActions } from './AdminBlendActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Blends — Admin' }

export default async function AdminBlendsPage() {
  const blends = await prisma.blend.findMany({
    select: {
      id: true,
      name: true,
      grade: true,
      authorName: true,
      viewCount: true,
      lastAccessedAt: true,
      createdAt: true,
      isFeatured: true,
      isPinned: true,
      isHidden: true,
      // Owner info — email is the canonical identifier in the admin list;
      // user.name is what gets shown publicly on /blend/[id].
      user: { select: { email: true, name: true } },
      _count: { select: { ingredients: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">Blend Admin</h1>
        </div>
        <Link
          href="/admin/blends/import"
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          + Promote Blend
        </Link>
      </div>

      <AdminBlendActions blends={blends} />
    </div>
  )
}
