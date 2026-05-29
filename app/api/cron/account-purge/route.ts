import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, accountInactivityWarningEmail } from '@/lib/email'
import { verifyCronAuth } from '@/lib/cron-auth'

// Account lifecycle cron (v1.3.0).
//
// Three-stage purge based on user inactivity:
//   1. ~14 days before deletion → send first warning, stamp purgeWarningSentAt
//   2.  ~3 days before deletion → send final warning, stamp purgeFinalWarningSentAt
//   3.  deletion-day             → delete user (cascade: sessions, accounts,
//                                  and blends become anonymous via SET NULL)
//
// "Activity" anchor: lastSignInAt if set, else createdAt (covers users who
// signed up but never came back). Signing in resets lastSignInAt AND clears
// both warning timestamps (see auth.ts jwt callback).
//
// Protected by Authorization: Bearer <CRON_SECRET>.
//
// Suggested host cron (runs at 03:30 daily, after the blend purge at 03:00):
//   30 3 * * *  curl -sf -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/account-purge
//
// Exempt users (purgeExempt = true) are skipped at every stage. Use this for
// the global admin account and, in v2+, paid-tier users.

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
const WARN_BEFORE_MS = 14 * 24 * 60 * 60 * 1000
const FINAL_WARN_BEFORE_MS = 3 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const unauthorized = verifyCronAuth(req)
  if (unauthorized) return unauthorized

  const now = Date.now()
  const deleteCutoff = new Date(now - ONE_YEAR_MS)
  const finalWarnCutoff = new Date(now - (ONE_YEAR_MS - FINAL_WARN_BEFORE_MS))
  const warnCutoff = new Date(now - (ONE_YEAR_MS - WARN_BEFORE_MS))

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const signInUrl = `${baseUrl}/login`

  // Stage 1 — first warning (~14 days out).
  // Matches users inactive ≥ (1y − 14d) who haven't been warned yet.
  const firstWarnCandidates = await prisma.user.findMany({
    where: {
      purgeExempt: false,
      purgeWarningSentAt: null,
      OR: [
        { lastSignInAt: { lt: warnCutoff } },
        { lastSignInAt: null, createdAt: { lt: warnCutoff } },
      ],
    },
    select: { id: true, email: true },
  })

  let firstWarnSent = 0
  for (const u of firstWarnCandidates) {
    try {
      await sendEmail(accountInactivityWarningEmail({ to: u.email, daysUntilDelete: 14, signInUrl }))
      await prisma.user.update({
        where: { id: u.id },
        data: { purgeWarningSentAt: new Date() },
      })
      firstWarnSent++
    } catch (err) {
      console.error(`[account-purge] first-warn failed for user=${u.id}`, err)
    }
  }

  // Stage 2 — final warning (~3 days out).
  // Matches users inactive ≥ (1y − 3d) who have a first warning but no final.
  const finalWarnCandidates = await prisma.user.findMany({
    where: {
      purgeExempt: false,
      purgeWarningSentAt: { not: null },
      purgeFinalWarningSentAt: null,
      OR: [
        { lastSignInAt: { lt: finalWarnCutoff } },
        { lastSignInAt: null, createdAt: { lt: finalWarnCutoff } },
      ],
    },
    select: { id: true, email: true },
  })

  let finalWarnSent = 0
  for (const u of finalWarnCandidates) {
    try {
      await sendEmail(accountInactivityWarningEmail({ to: u.email, daysUntilDelete: 3, signInUrl }))
      await prisma.user.update({
        where: { id: u.id },
        data: { purgeFinalWarningSentAt: new Date() },
      })
      finalWarnSent++
    } catch (err) {
      console.error(`[account-purge] final-warn failed for user=${u.id}`, err)
    }
  }

  // Stage 3 — delete. Both warnings sent, full inactivity window elapsed.
  const { count: deleted } = await prisma.user.deleteMany({
    where: {
      purgeExempt: false,
      purgeFinalWarningSentAt: { not: null },
      OR: [
        { lastSignInAt: { lt: deleteCutoff } },
        { lastSignInAt: null, createdAt: { lt: deleteCutoff } },
      ],
    },
  })

  return NextResponse.json({
    firstWarnSent,
    finalWarnSent,
    deleted,
    message: `Sent ${firstWarnSent} first warnings, ${finalWarnSent} final warnings, deleted ${deleted} accounts.`,
  })
}
