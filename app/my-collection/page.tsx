import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { formatCurrency, DEFAULT_CURRENCY } from '@/lib/currency'
import { CollectionList } from './CollectionList'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Collection' }

const MS_PER_DAY = 86_400_000
const EXPIRY_WARN_DAYS = 30

export default async function MyCollectionPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [user, entries] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currency: true },
    }),
    prisma.userOilCollection.findMany({
      where: { userId: session.user.id },
      include: {
        oil: {
          select: {
            id: true,
            name: true,
            botanicalName: true,
            type: true,
            aroma: true,
            shelfLifeMonths: true,
            buyUrl: true,
          },
        },
      },
      orderBy: [{ oil: { type: 'asc' } }, { oil: { name: 'asc' } }],
    }),
  ])
  const currency = user?.currency ?? DEFAULT_CURRENCY

  // Compute effective expiry: explicit expiresAt wins; else derive from
  // openedAt + Oil.shelfLifeMonths (carriers have this; EOs typically don't).
  const now = Date.now()
  const enriched = entries.map((e) => {
    let effectiveExpiry: Date | null = null
    if (e.expiresAt) {
      effectiveExpiry = e.expiresAt
    } else if (e.openedAt && e.oil.shelfLifeMonths) {
      const d = new Date(e.openedAt)
      d.setMonth(d.getMonth() + e.oil.shelfLifeMonths)
      effectiveExpiry = d
    }
    const daysUntilExpiry = effectiveExpiry
      ? Math.floor((effectiveExpiry.getTime() - now) / MS_PER_DAY)
      : null
    return {
      ...e,
      addedAt: e.addedAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      openedAt: e.openedAt?.toISOString() ?? null,
      expiresAt: e.expiresAt?.toISOString() ?? null,
      effectiveExpiry: effectiveExpiry?.toISOString() ?? null,
      daysUntilExpiry,
      isCarrier: e.oil.type === 'CARRIER',
    }
  })

  // Stats strip
  const total = enriched.length
  const carrierCount = enriched.filter((e) => e.isCarrier).length
  const eoCount = total - carrierCount
  const totalSpend = enriched.reduce((s, e) => s + (e.cost ?? 0), 0)
  const expiringSoon = enriched.filter(
    (e) => e.daysUntilExpiry != null && e.daysUntilExpiry <= EXPIRY_WARN_DAYS,
  ).length

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">My Collection</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            The oils you actually own — drives the &ldquo;from my collection&rdquo; filter in the builder.
          </p>
        </div>
        <Link href="/oils">
          <Button>Browse oil library</Button>
        </Link>
      </div>

      {total > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total oils" value={`${total}`} sublabel={`${carrierCount} carriers · ${eoCount} essentials`} />
          <Stat label="Total spend" value={totalSpend > 0 ? formatCurrency(totalSpend, currency) : '—'} sublabel="based on entered costs" />
          <Stat
            label="Expiring soon"
            value={`${expiringSoon}`}
            sublabel={`within ${EXPIRY_WARN_DAYS} days`}
            tone={expiringSoon > 0 ? 'amber' : 'default'}
          />
          <Stat label="Library coverage" value={`${total}`} sublabel="oils in your inventory" />
        </div>
      )}

      {total === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="mb-3 text-lg text-stone-700 dark:text-stone-200">Your collection is empty.</p>
            <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">
              Open any oil&apos;s page and click <strong>Add to my collection</strong>.
              Then the builder can show you only oils you actually own.
            </p>
            <Link href="/oils">
              <Button>Browse oil library</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <CollectionList entries={enriched} expiryWarnDays={EXPIRY_WARN_DAYS} currency={currency} />
      )}
    </div>
  )
}

