import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import type { BlendGrade } from '@/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Blends' }

export default async function MyBlendsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const blends = await prisma.blend.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      grade: true,
      createdAt: true,
      viewCount: true,
      isShared: true,
      isFeatured: true,
      isPinned: true,
      ingredients: {
        where: { oil: { type: 'ESSENTIAL' } },
        select: { oil: { select: { name: true } } },
        take: 3,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">My Blends</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {blends.length} blend{blends.length === 1 ? '' : 's'} saved to your account.
          </p>
        </div>
        <Link href="/blend">
          <Button>Build a new blend</Button>
        </Link>
      </div>

      {blends.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="mb-3 text-lg text-stone-700 dark:text-stone-200">You haven&apos;t saved any blends yet.</p>
            <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">
              Build one and hit Save — it&apos;ll appear here.
            </p>
            <Link href="/blend">
              <Button>Build a blend</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {blends.map((b) => {
            const topOils = b.ingredients.map((i) => i.oil.name).join(' · ')
            const date = new Date(b.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })
            return (
              <Link
                key={b.id}
                href={`/blend/${b.id}`}
                className="group flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-amber-300 hover:shadow-md dark:border-stone-700 dark:bg-stone-800 dark:hover:border-amber-600"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={b.grade as BlendGrade}>Grade {b.grade}</Badge>
                    {b.isShared ? (
                      <span className="text-xs text-emerald-700 dark:text-emerald-400">🌐 Public</span>
                    ) : (
                      <span className="text-xs text-stone-500 dark:text-stone-400">🔒 Private</span>
                    )}
                    {b.isPinned && <span className="text-xs" title="Pinned">📌</span>}
                    {b.isFeatured && <span className="text-xs" title="Featured">⭐</span>}
                  </div>
                  <span className="shrink-0 text-xs text-stone-400 dark:text-stone-500">
                    {b.viewCount} view{b.viewCount === 1 ? '' : 's'}
                  </span>
                </div>
                <h2 className="mb-1 font-serif text-lg font-semibold text-stone-900 group-hover:text-amber-700 dark:text-stone-100 dark:group-hover:text-amber-400">
                  {b.name}
                </h2>
                {topOils && (
                  <p className="mb-3 text-xs text-stone-400 dark:text-stone-500">{topOils}</p>
                )}
                <p className="mt-auto text-xs text-stone-400 dark:text-stone-500">{date}</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
