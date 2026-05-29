import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { DROPS_PER_ML } from '@/lib/blend-calculator'

export const dynamic = 'force-dynamic'
import { Badge } from '@/components/ui/Badge'
import { BlendScaler } from '@/components/blend/BlendScaler'
import { CompatibilityPanel } from '@/components/blend/CompatibilityPanel'
import { BlendPdfDownload } from '@/components/blend/BlendPdfDownload'
import { CopyButton } from '@/components/ui/CopyButton'
import { OwnerControls } from './OwnerControls'
import { ClaimButton } from './ClaimButton'
import type { BlendDetail, BlendGrade, PairingRating } from '@/types'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const blend = await prisma.blend.findUnique({ where: { id }, select: { name: true } })
  return { title: blend ? blend.name : 'Blend Not Found' }
}

export default async function BlendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [blend, session] = await Promise.all([
    prisma.blend.findUnique({
      where: { id },
      include: {
        ingredients: {
          include: {
            oil: {
              select: { id: true, name: true, type: true, benefits: true, contraindications: true, aroma: true, buyUrl: true },
            },
          },
        },
        user: { select: { id: true, name: true } },
      },
    }),
    auth(),
  ])

  if (!blend) notFound()

  // Access control:
  //   • Anonymous blends (userId == null)        → public by URL (legacy contract)
  //   • Owned + isShared                          → public by URL
  //   • Owned + !isShared + viewer is owner       → owner can view
  //   • Owned + !isShared + viewer is NOT owner   → 404 (don't leak existence)
  const viewerId = session?.user?.id ?? null
  const isOwner = blend.userId !== null && blend.userId === viewerId
  const isViewable = blend.userId === null || blend.isShared || isOwner
  if (!isViewable) notFound()

  const canClaim = viewerId !== null && blend.userId === null

  // v1.4: which of this blend's oils does the viewer already own? Empty
  // arrays when signed out — the shopping list card is hidden in that case.
  // Single partition pass over ingredients.
  const ownedIngredients: typeof blend.ingredients = []
  const missingIngredients: typeof blend.ingredients = []
  if (viewerId) {
    const owned = await prisma.userOilCollection.findMany({
      where: { userId: viewerId, oilId: { in: blend.ingredients.map((i) => i.oilId) } },
      select: { oilId: true },
    })
    const ownedIds = new Set(owned.map((o) => o.oilId))
    for (const ing of blend.ingredients) {
      (ownedIds.has(ing.oilId) ? ownedIngredients : missingIngredients).push(ing)
    }
  }

  // Fire-and-forget — don't await so page render isn't delayed
  prisma.blend.update({
    where: { id },
    data: { viewCount: { increment: 1 }, lastAccessedAt: new Date() },
  }).catch(() => {})

  const oilIds = blend.ingredients.map((i) => i.oilId)
  const pairingsRaw = await prisma.oilPairing.findMany({
    where: { oilAId: { in: oilIds }, oilBId: { in: oilIds } },
    include: {
      oilA: { select: { id: true, name: true } },
      oilB: { select: { id: true, name: true } },
    },
  })

  const pairings = pairingsRaw.map((p) => ({
      oilAId: p.oilAId,
      oilAName: p.oilA.name,
      oilBId: p.oilBId,
      oilBName: p.oilB.name,
      rating: p.rating as PairingRating,
      reason: p.reason,
    }))

  // Source of truth for "by …":
  //   • Owned blend → live User.name (auto-updates when owner renames themselves)
  //   • Otherwise   → legacy authorName (admin-promoted blends)
  const displayAuthor = blend.user?.name ?? blend.authorName

  const blendDetail: BlendDetail = {
    id: blend.id,
    name: blend.name,
    description: blend.description,
    totalVolumeMl: blend.totalVolumeMl,
    dilutionRate: blend.dilutionRate,
    purpose: blend.purpose,
    notes: blend.notes,
    grade: blend.grade as BlendGrade,
    createdAt: blend.createdAt.toISOString(),
    viewCount: blend.viewCount,
    lastAccessedAt: blend.lastAccessedAt?.toISOString() ?? null,
    authorName: displayAuthor,
    about: blend.about,
    isFeatured: blend.isFeatured,
    isPinned: blend.isPinned,
    isHidden: blend.isHidden,
    ingredients: blend.ingredients.map((i) => ({
      oilId: i.oilId,
      oilName: i.oil.name,
      oilType: i.oil.type as 'ESSENTIAL' | 'CARRIER',
      percentagePct: i.percentagePct,
      volumeMl: i.volumeMl,
      drops: Math.round(i.volumeMl * DROPS_PER_ML),
      benefits: i.oil.benefits,
      contraindications: i.oil.contraindications,
      aroma: i.oil.aroma,
    })),
    pairings,
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const shareUrl = `${baseUrl}/blend/${id}`

  const isProtected = blend.isFeatured || blend.isPinned
  const lastAccess = blend.lastAccessedAt ?? blend.createdAt
  const daysSinceAccess = Math.floor((Date.now() - lastAccess.getTime()) / 86_400_000)
  const daysUntilPurge = 30 - daysSinceAccess

  const scalerIngredients = blendDetail.ingredients.map((i) => ({
    oilId: i.oilId,
    name: i.oilName,
    type: i.oilType,
    percentagePct: i.percentagePct,
    volumeMl: i.oilType === 'CARRIER' ? i.volumeMl : undefined,
  }))

  const date = new Date(blend.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-stone-500">{date}</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">{blend.name}</h1>
          {displayAuthor && (
            <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">by {displayAuthor}</p>
          )}
          {(blend.about || blend.description) && (
            <p className="mt-1 text-stone-600 dark:text-stone-400">{blend.about ?? blend.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-sm text-stone-500 dark:text-stone-400">
            <span>{blend.totalVolumeMl}ml</span>
            <span>·</span>
            <span>{(blend.dilutionRate * 100).toFixed(0)}% dilution</span>
            <span>·</span>
            <Badge variant={blend.grade as BlendGrade}>Grade {blend.grade}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <BlendPdfDownload blend={blendDetail} baseUrl={baseUrl} />
          <Link href={`/blend?from=${blend.id}`}>
            <Button variant="secondary">Build from this blend</Button>
          </Link>
          <Link href="/blend">
            <Button variant="secondary">Build Another</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Quantity table */}
          <Card>
            <CardHeader>
              <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">Ingredients</h2>
            </CardHeader>
            <CardBody>
              <BlendScaler
                originalVolumeMl={blend.totalVolumeMl}
                dilutionRate={blend.dilutionRate}
                ingredients={scalerIngredients}
              />
            </CardBody>
          </Card>

          {/* Per-oil profiles */}
          <Card>
            <CardHeader>
              <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">Oil Profiles</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {blendDetail.ingredients.map((i) => (
                <div key={i.oilId} className="rounded-lg border border-stone-100 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800">
                  <div className="mb-2 flex items-center justify-between">
                    <Link
                      href={`/oils/${i.oilId}`}
                      className="font-serif font-semibold text-stone-800 hover:text-amber-700 dark:text-stone-200 dark:hover:text-amber-400"
                    >
                      {i.oilName}
                    </Link>
                    <Badge>{i.oilType === 'CARRIER' ? 'Carrier' : 'Essential Oil'}</Badge>
                  </div>
                  <ul className="space-y-0.5">
                    {i.benefits.slice(0, 4).map((b, idx) => (
                      <li key={idx} className="text-sm text-stone-600 dark:text-stone-300">• {b}</li>
                    ))}
                  </ul>
                  {i.contraindications.length > 0 && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">⚠ {i.contraindications[0]}</p>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Compatibility */}
          <Card>
            <CardHeader>
              <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">Compatibility</h2>
            </CardHeader>
            <CardBody>
              <CompatibilityPanel
                grade={blend.grade as BlendGrade}
                summary={
                  blend.grade === 'A'
                    ? 'All pairings in this blend are compatible.'
                    : blend.grade === 'B'
                    ? 'Good blend — some pairings have notes.'
                    : 'Fair blend — review the pairing notes.'
                }
                pairings={pairings}
              />
            </CardBody>
          </Card>

          {/* Claim — only if authenticated viewer is looking at an unowned blend */}
          {canClaim && (
            <Card>
              <CardHeader>
                <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">Claim This Blend</h2>
              </CardHeader>
              <CardBody>
                <ClaimButton blendId={blend.id} />
              </CardBody>
            </Card>
          )}

          {/* Share — privacy toggle when owner is viewing */}
          <Card>
            <CardHeader>
              <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">
                {isOwner ? 'Share This Blend' : 'Share This Blend'}
              </h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {isOwner && (
                <OwnerControls blendId={blend.id} initialShared={blend.isShared} />
              )}
              {(blend.userId === null || blend.isShared || isOwner) && (
                <>
                  <p className="break-all rounded bg-stone-50 px-3 py-2 font-mono text-xs text-stone-600 dark:bg-stone-700 dark:text-stone-400">
                    {shareUrl}
                  </p>
                  <CopyButton text={shareUrl} />
                </>
              )}
              {!isProtected && (
                daysUntilPurge <= 10
                  ? <p className="text-xs text-amber-700 dark:text-amber-500">
                      Last visited {daysSinceAccess} day{daysSinceAccess === 1 ? '' : 's'} ago — this blend will be auto-removed in {Math.max(0, daysUntilPurge)} day{daysUntilPurge === 1 ? '' : 's'} unless opened again.
                    </p>
                  : <p className="text-xs text-stone-400 dark:text-stone-500">
                      Blends are auto-removed after 30 days without a visit — opening this page counts as a visit.
                    </p>
              )}
            </CardBody>
          </Card>

          {/* Shopping list — only when signed in; hidden if the viewer owns everything */}
          {viewerId && missingIngredients.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">Shopping list</h2>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                  {missingIngredients.length} oil{missingIngredients.length === 1 ? '' : 's'} you don&apos;t own yet
                </p>
              </CardHeader>
              <CardBody className="space-y-3">
                <ul className="space-y-1.5">
                  {missingIngredients.map((i) => (
                    <li key={i.oilId} className="flex items-center justify-between gap-3 text-sm">
                      <Link
                        href={`/oils/${i.oilId}`}
                        className="text-stone-800 hover:text-amber-700 dark:text-stone-200 dark:hover:text-amber-400"
                      >
                        {i.oil.name}
                      </Link>
                      {i.oil.buyUrl ? (
                        <a
                          href={i.oil.buyUrl}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          className="shrink-0 text-xs font-medium text-amber-700 hover:underline dark:text-amber-500"
                        >
                          Buy ↗
                        </a>
                      ) : (
                        <span className="shrink-0 text-xs text-stone-400 dark:text-stone-500">no link</span>
                      )}
                    </li>
                  ))}
                </ul>
                {ownedIngredients.length > 0 && (
                  <p className="border-t border-stone-100 pt-2 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
                    You already have{' '}
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {ownedIngredients.length} of {blend.ingredients.length}
                    </span>{' '}
                    oils in this recipe.
                  </p>
                )}
              </CardBody>
            </Card>
          )}
          {viewerId && missingIngredients.length === 0 && blend.ingredients.length > 0 && (
            <Card>
              <CardBody className="text-sm text-emerald-700 dark:text-emerald-400">
                ✓ You have every oil in this blend in your collection.
              </CardBody>
            </Card>
          )}

          {/* Notes */}
          {blend.notes && (
            <Card>
              <CardHeader>
                <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">Notes</h2>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-line text-sm text-stone-600 dark:text-stone-400">{blend.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
