import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronAuth } from '@/lib/cron-auth'

// Purge anonymous (userId == null) blends inactive for 30+ days.
// Protected by Authorization: Bearer <CRON_SECRET>.
//
// Suggested host cron (runs at 03:00 daily):
//   0 3 * * *  curl -sf -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/purge
//
// Featured and pinned blends are never purged.
// Owned blends (userId set) are never purged — they belong to a user account
// and persist for the lifetime of that account (see /my-blends).

export async function GET(req: NextRequest) {
  const unauthorized = verifyCronAuth(req)
  if (unauthorized) return unauthorized

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const { count } = await prisma.blend.deleteMany({
    where: {
      userId: null,
      isFeatured: false,
      isPinned: false,
      OR: [
        { lastAccessedAt: { lt: cutoff } },
        { lastAccessedAt: null, createdAt: { lt: cutoff } },
      ],
    },
  })

  return NextResponse.json({ deleted: count, message: `Purged ${count} inactive blend(s)` })
}
