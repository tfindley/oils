import { prisma } from '@/lib/prisma'
import { BlendCard } from '@/components/blends/BlendCard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Blends',
  description: 'Explore curated massage oil blends crafted by our community.',
}

export default async function BlendsPage() {
  const blends = await prisma.blend.findMany({
    where: {
      isHidden: false,
      // Privacy gate: anonymous blends (no userId) are public by URL; owned
      // blends only appear in public listings when explicitly shared.
      OR: [{ userId: null }, { isShared: true }],
      AND: {
        OR: [{ isFeatured: true }, { isPinned: true }, { viewCount: { gte: 5 } }],
      },
    },
    select: {
      id: true,
      name: true,
      grade: true,
      authorName: true,
      about: true,
      viewCount: true,
      isPinned: true,
      isFeatured: true,
      ingredients: {
        where: { oil: { type: 'ESSENTIAL' } },
        include: { oil: { select: { name: true } } },
        take: 3,
      },
    },
    orderBy: [
      { isPinned: 'desc' },
      { isFeatured: 'desc' },
      { viewCount: 'desc' },
    ],
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">Blends</h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          Curated and popular massage oil blends. Click any card to see the full recipe.
        </p>
      </div>

      {blends.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-lg text-stone-400 dark:text-stone-500">No featured blends yet.</p>
          <p className="mt-2 text-sm text-stone-400 dark:text-stone-500">
            Build a blend and ask an admin to feature it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {blends.map((b) => (
            <BlendCard
              key={b.id}
              id={b.id}
              name={b.name}
              grade={b.grade}
              authorName={b.authorName}
              about={b.about}
              viewCount={b.viewCount}
              isPinned={b.isPinned}
              topOils={b.ingredients.map((i) => i.oil.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
