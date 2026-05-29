import { prisma } from '@/lib/prisma'
import { BlendBuilder } from '@/components/blend/BlendBuilder'
import { getSettings } from '@/lib/settings'
import { auth } from '@/auth'
import type { OilSummary } from '@/types'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Build a Blend',
  description: 'Create a custom massage oil blend with compatibility scoring and a printable recipe card.',
}

const OIL_SELECT = {
  id: true,
  name: true,
  botanicalName: true,
  type: true,
  aroma: true,
  benefits: true,
  description: true,
  consistency: true,
  absorbency: true,
  dilutionRateMax: true,
} as const

export default async function BlendPage({ searchParams }: { searchParams: Promise<{ from?: string; oil?: string }> }) {
  const { from, oil: pendingOilId } = await searchParams
  const { tooltipsEnabled } = await getSettings()

  const [oils, fromBlendRaw, session] = await Promise.all([
    prisma.oil.findMany({ select: OIL_SELECT, orderBy: { name: 'asc' } }),
    from
      ? prisma.blend.findUnique({
          where: { id: from },
          select: {
            userId: true,
            isShared: true,
            totalVolumeMl: true,
            dilutionRate: true,
            ingredients: {
              select: {
                percentagePct: true,
                volumeMl: true,
                oil: { select: OIL_SELECT },
              },
            },
          },
        })
      : Promise.resolve(null),
    auth().catch(() => null),
  ])

  // v1.4: fetch the signed-in user's collection oil IDs so the builder can
  // render a "From my collection" filter in each picker. Empty for guests.
  const collectionOilIds = session?.user?.id
    ? (
        await prisma.userOilCollection.findMany({
          where: { userId: session.user.id },
          select: { oilId: true },
        })
      ).map((r) => r.oilId)
    : []

  // Apply blend access control to the clone source — same rule as /blend/[id]:
  // anonymous (userId null) is public by URL; owned blends require isShared OR
  // viewer is the owner. Mismatch ⇒ silently drop the prefill.
  const viewerId = session?.user?.id ?? null
  const fromBlendData =
    fromBlendRaw &&
    (fromBlendRaw.userId === null ||
      fromBlendRaw.isShared ||
      fromBlendRaw.userId === viewerId)
      ? fromBlendRaw
      : null

  const carriers = oils.filter((o) => o.type === 'CARRIER') as OilSummary[]
  const essentials = oils.filter((o) => o.type === 'ESSENTIAL') as OilSummary[]

  let initialBlend: {
    carriers: Array<{ oil: OilSummary; volumeMl: number }>
    essentials: Array<{ oil: OilSummary; percentagePct: number }>
    totalVolumeMl: number
    dilutionRate: number
  } | undefined
  if (fromBlendData) {
    initialBlend = {
      carriers: fromBlendData.ingredients
        .filter((i) => i.oil.type === 'CARRIER')
        .map((c) => ({ oil: c.oil as OilSummary, volumeMl: c.volumeMl })),
      essentials: fromBlendData.ingredients
        .filter((i) => i.oil.type === 'ESSENTIAL')
        .map((i) => ({ oil: i.oil as OilSummary, percentagePct: i.percentagePct })),
      totalVolumeMl: fromBlendData.totalVolumeMl,
      dilutionRate: fromBlendData.dilutionRate,
    }
  }

  if (oils.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="mb-4 text-4xl">🌿</div>
        <h1 className="mb-4 font-serif text-2xl font-bold text-stone-800">
          Oil library is empty
        </h1>
        <p className="text-stone-600">
          Run <code className="rounded bg-stone-100 px-1.5 py-0.5 text-sm">npm run enrich</code> to populate the database with oil data.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-stone-900">Build Your Blend</h1>
        <p className="mt-2 text-stone-600">
          Choose your carrier oils, add essential oils, and see your compatibility score in real time.
        </p>
      </div>
      <BlendBuilder
        carriers={carriers}
        essentials={essentials}
        initialBlend={initialBlend}
        pendingOilId={pendingOilId}
        tooltipsEnabled={tooltipsEnabled}
        collectionOilIds={collectionOilIds}
      />
    </div>
  )
}
