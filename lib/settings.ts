import { cache } from 'react'
import type { Settings as PrismaSettings } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Singleton settings row keyed by id="singleton". Two layers of caching:
//   • React.cache() — dedupes within a single render (Footer + page).
//   • Module-level TTL cache (below) — dedupes across requests, which the
//     proxy.ts maintenance gate relies on so it doesn't hit Prisma on every
//     request after the broadened matcher in v1.4.x.
//
// Writes invalidate the cache for the writing process. Other processes /
// containers see up to TTL_MS of staleness. Acceptable: settings change rarely.

export type SiteSettings = Omit<PrismaSettings, 'id' | 'updatedAt'>

const DEFAULTS: SiteSettings = {
  tooltipsEnabled: true,
  issueReportingEnabled: true,
  allowAnonymousSaves: true,
  legacyAdminEnabled: true,
  maintenanceMode: false,
}

function pick(row: PrismaSettings): SiteSettings {
  const { id: _id, updatedAt: _updatedAt, ...rest } = row
  return rest
}

const TTL_MS = 30_000
let cached: { value: SiteSettings; expiresAt: number } | null = null

export const getSettings = cache(async (): Promise<SiteSettings> => {
  if (cached && cached.expiresAt > Date.now()) return cached.value
  try {
    const row =
      (await prisma.settings.findUnique({ where: { id: 'singleton' } })) ??
      (await prisma.settings.create({ data: { id: 'singleton', ...DEFAULTS } }))
    const value = pick(row)
    cached = { value, expiresAt: Date.now() + TTL_MS }
    return value
  } catch {
    // Don't poison the cache with DEFAULTS — let the next call retry.
    return DEFAULTS
  }
})

export async function updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const row = await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: patch,
    create: { id: 'singleton', ...DEFAULTS, ...patch },
  })
  const value = pick(row)
  cached = { value, expiresAt: Date.now() + TTL_MS }
  return value
}
