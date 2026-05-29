import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [blend, session] = await Promise.all([
    prisma.blend.findUnique({
      where: { id },
      include: {
        ingredients: {
          include: {
            oil: {
              select: {
                id: true,
                name: true,
                type: true,
                benefits: true,
                contraindications: true,
                aroma: true,
              },
            },
          },
        },
      },
    }),
    auth().catch(() => null),
  ])

  if (!blend) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Mirror the access control on app/blend/[id]/page.tsx — anonymous blends are
  // public by URL; owned blends require isShared OR viewer is owner.
  const viewerId = session?.user?.id ?? null
  const isOwner = blend.userId !== null && blend.userId === viewerId
  const isViewable = blend.userId === null || blend.isShared || isOwner
  if (!isViewable) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const oilIds = blend.ingredients.map((i) => i.oilId)

  const pairings = await prisma.oilPairing.findMany({
    where: {
      oilAId: { in: oilIds },
      oilBId: { in: oilIds },
    },
    include: {
      oilA: { select: { id: true, name: true } },
      oilB: { select: { id: true, name: true } },
    },
  })

  const relevantPairings = pairings
    .filter((p) => oilIds.includes(p.oilAId) && oilIds.includes(p.oilBId))
    .map((p) => ({
      oilAId: p.oilAId,
      oilAName: p.oilA.name,
      oilBId: p.oilBId,
      oilBName: p.oilB.name,
      rating: p.rating,
      reason: p.reason,
    }))

  const result = {
    id: blend.id,
    name: blend.name,
    description: blend.description,
    totalVolumeMl: blend.totalVolumeMl,
    dilutionRate: blend.dilutionRate,
    purpose: blend.purpose,
    notes: blend.notes,
    grade: blend.grade,
    createdAt: blend.createdAt.toISOString(),
    ingredients: blend.ingredients.map((i) => ({
      oilId: i.oilId,
      oilName: i.oil.name,
      oilType: i.oil.type,
      percentagePct: i.percentagePct,
      volumeMl: i.volumeMl,
      drops: Math.round(i.volumeMl * 20),
      benefits: i.oil.benefits,
      contraindications: i.oil.contraindications,
      aroma: i.oil.aroma,
    })),
    pairings: relevantPairings,
  }

  return NextResponse.json(result)
}
