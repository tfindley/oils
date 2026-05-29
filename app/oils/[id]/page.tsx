import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PairingBadge } from '@/components/blend/PairingBadge'
import { Button } from '@/components/ui/Button'
import { AddToBlendButton } from '@/components/oils/AddToBlendButton'
import { AddToCompareButton } from '@/components/oils/AddToCompareButton'
import { AddToCollectionButton } from '@/components/oils/AddToCollectionButton'
import type { PairingRating } from '@/types'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const oil = await prisma.oil.findUnique({ where: { id }, select: { name: true } })
  return { title: oil ? oil.name : 'Oil Not Found' }
}

export default async function OilDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [oil, session] = await Promise.all([
    prisma.oil.findUnique({
      where: { id },
      include: {
        pairsWithA: { include: { oilB: { select: { id: true, name: true } } } },
        pairsWithB: { include: { oilA: { select: { id: true, name: true } } } },
      },
    }),
    auth().catch(() => null),
  ])

  if (!oil) notFound()

  // Is this oil in the signed-in user's collection? Cheap one-row lookup; only
  // runs for authed sessions, otherwise inCollection stays false.
  let inCollection = false
  if (session?.user?.id) {
    const entry = await prisma.userOilCollection.findUnique({
      where: { userId_oilId: { userId: session.user.id, oilId: id } },
      select: { id: true },
    })
    inCollection = entry != null
  }

  const pairings = [
    ...oil.pairsWithA.map((p) => ({
      oilId: p.oilB.id,
      oilName: p.oilB.name,
      rating: p.rating as PairingRating,
      reason: p.reason,
    })),
    ...oil.pairsWithB.map((p) => ({
      oilId: p.oilA.id,
      oilName: p.oilA.name,
      rating: p.rating as PairingRating,
      reason: p.reason,
    })),
  ].sort((a, b) => {
    const order = { UNSAFE: 0, AVOID: 1, CAUTION: 2, EXCELLENT: 3, GOOD: 4 }
    return (order[a.rating] ?? 5) - (order[b.rating] ?? 5)
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/oils" className="mb-6 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200">
        ← Oil Library
      </Link>

      {/* Hero image */}
      {oil.imageUrl && (
        <div className="relative mb-8 h-56 w-full overflow-hidden rounded-xl sm:h-72">
          <Image
            src={oil.imageUrl}
            alt={oil.imageAlt ?? oil.name}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 896px) 100vw, 896px"
          />
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">{oil.name}</h1>
            <Badge variant={oil.type === 'ESSENTIAL' ? 'GOOD' : 'default'}>
              {oil.type === 'ESSENTIAL' ? 'Essential Oil' : 'Carrier Oil'}
            </Badge>
          </div>
          <p className="text-sm italic text-stone-500 dark:text-stone-400">{oil.botanicalName}</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">Origin: {oil.origin}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {oil.buyUrl && (
            <a href={oil.buyUrl} target="_blank" rel="noopener noreferrer sponsored">
              <Button variant="secondary">Buy this oil ↗</Button>
            </a>
          )}
          <AddToBlendButton oilId={oil.id} oilName={oil.name} oilType={oil.type as 'CARRIER' | 'ESSENTIAL'} />
          <AddToCompareButton oilId={oil.id} oilName={oil.name} />
          <AddToCollectionButton oilId={oil.id} inCollection={inCollection} signedIn={!!session?.user?.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardHeader><h2 className="font-serif font-semibold text-stone-800 dark:text-stone-200">About</h2></CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-stone-700 dark:text-stone-300">{oil.description}</p>
              <p className="text-sm italic text-stone-500 dark:text-stone-400">{oil.history}</p>
            </CardBody>
          </Card>

          {/* Benefits */}
          <Card>
            <CardHeader><h2 className="font-serif font-semibold text-stone-800 dark:text-stone-200">Benefits</h2></CardHeader>
            <CardBody>
              <ul className="space-y-1.5">
                {oil.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-700 dark:text-stone-300">
                    <span className="mt-0.5 text-amber-600 dark:text-amber-500">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {/* Pairings */}
          {pairings.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-serif font-semibold text-stone-800 dark:text-stone-200">Pairings ({pairings.length})</h2>
              </CardHeader>
              <CardBody className="space-y-2">
                {pairings.map((p) => (
                  <div key={p.oilId} className="flex items-start gap-3 rounded-lg border border-stone-100 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-900">
                    <PairingBadge rating={p.rating} className="mt-0.5 shrink-0" />
                    <div>
                      <Link href={`/oils/${p.oilId}`} className="text-sm font-medium text-stone-800 hover:text-amber-700 dark:text-stone-200 dark:hover:text-amber-400">
                        {p.oilName}
                      </Link>
                      {p.rating !== 'GOOD' && (
                        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{p.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="font-serif font-semibold text-stone-800 dark:text-stone-200">Properties</h2></CardHeader>
            <CardBody>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-stone-400">Aroma</dt>
                  <dd className="mt-0.5 italic text-stone-700 dark:text-stone-300">{oil.aroma}</dd>
                </div>
                {oil.type === 'CARRIER' && (
                  <>
                    {oil.consistency && (
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-stone-400">Consistency</dt>
                        <dd className="mt-0.5 capitalize text-stone-700 dark:text-stone-300">{oil.consistency}</dd>
                      </div>
                    )}
                    {oil.absorbency && (
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-stone-400">Absorbency</dt>
                        <dd className="mt-0.5 capitalize text-stone-700 dark:text-stone-300">{oil.absorbency}</dd>
                      </div>
                    )}
                    {oil.shelfLifeMonths != null && (
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-stone-400">Shelf Life</dt>
                        <dd className="mt-0.5 text-stone-700 dark:text-stone-300">{oil.shelfLifeMonths} months</dd>
                      </div>
                    )}
                  </>
                )}
                {oil.type === 'ESSENTIAL' && oil.dilutionRateMax != null && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-stone-400">Max Dilution</dt>
                    <dd className="mt-0.5 text-stone-700 dark:text-stone-300">{(oil.dilutionRateMax * 100).toFixed(0)}%</dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>

          {oil.contraindications.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-serif font-semibold text-amber-800 dark:text-amber-500">Contraindications</h2>
              </CardHeader>
              <CardBody>
                <ul className="space-y-1.5">
                  {oil.contraindications.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-400">
                      <span className="mt-0.5 shrink-0">⚠</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
