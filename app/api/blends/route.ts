import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { getSettings } from '@/lib/settings'
import { auth } from '@/auth'
import { z } from 'zod'

const CreateBlendSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  totalVolumeMl: z.number().positive(),
  dilutionRate: z.number().min(0.001).max(0.1),
  purpose: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  grade: z.enum(['A', 'B', 'C', 'F']),
  ingredients: z
    .array(
      z.object({
        oilId: z.string(),
        percentagePct: z.number().min(0),
        volumeMl: z.number().min(0),
      })
    )
    .min(2),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`save:${ip}`, 10, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many saves — try again in a moment.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const [session, settings] = await Promise.all([auth(), getSettings()])

  if (!session?.user?.id && !settings.allowAnonymousSaves) {
    return NextResponse.json(
      { error: 'Sign in to save blends. Anonymous saves are currently disabled.' },
      { status: 401 },
    )
  }

  const body = await req.json()
  const parsed = CreateBlendSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  const oilIds = data.ingredients.map((i) => i.oilId)

  const [carrierCount, unsafePairings] = await Promise.all([
    prisma.oil.count({
      where: { id: { in: oilIds }, type: 'CARRIER' },
    }),
    prisma.oilPairing.findMany({
      where: {
        rating: 'UNSAFE',
        oilAId: { in: oilIds },
        oilBId: { in: oilIds },
      },
    }),
  ])

  if (carrierCount === 0) {
    return NextResponse.json(
      { error: 'Blend must include at least one carrier oil.' },
      { status: 422 }
    )
  }

  const actualUnsafe = unsafePairings.filter(
    (p) => oilIds.includes(p.oilAId) && oilIds.includes(p.oilBId)
  )

  if (actualUnsafe.length > 0) {
    return NextResponse.json(
      { error: 'Blend contains unsafe oil combinations and cannot be saved.' },
      { status: 422 }
    )
  }

  const blend = await prisma.blend.create({
    data: {
      name: data.name,
      description: data.description,
      totalVolumeMl: data.totalVolumeMl,
      dilutionRate: data.dilutionRate,
      purpose: data.purpose,
      notes: data.notes,
      grade: data.grade,
      // v1.2: ownership. Authed saves get a userId + default-private.
      // Anonymous saves stay reachable by URL (existing contract).
      userId: session?.user?.id ?? null,
      isShared: false,
      ingredients: {
        create: data.ingredients.map((i) => ({
          oilId: i.oilId,
          percentagePct: i.percentagePct,
          volumeMl: i.volumeMl,
        })),
      },
    },
  })

  return NextResponse.json({ id: blend.id }, { status: 201 })
}
