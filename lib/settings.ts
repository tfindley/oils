import { cache } from 'react'
import { prisma } from '@/lib/prisma'

// Singleton settings row keyed by id="singleton". `getSettings()` is wrapped in
// React's `cache()` so multiple callers within the same request (Footer +
// page) share one DB hit. Falls back to defaults if the migration hasn't run.

export interface SiteSettings {
  tooltipsEnabled: boolean
  issueReportingEnabled: boolean
  allowAnonymousSaves: boolean
}

const DEFAULTS: SiteSettings = {
  tooltipsEnabled: true,
  issueReportingEnabled: true,
  allowAnonymousSaves: true,
}

function pick(row: { tooltipsEnabled: boolean; issueReportingEnabled: boolean; allowAnonymousSaves: boolean }): SiteSettings {
  return {
    tooltipsEnabled: row.tooltipsEnabled,
    issueReportingEnabled: row.issueReportingEnabled,
    allowAnonymousSaves: row.allowAnonymousSaves,
  }
}

export const getSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const row =
      (await prisma.settings.findUnique({ where: { id: 'singleton' } })) ??
      (await prisma.settings.create({ data: { id: 'singleton', ...DEFAULTS } }))
    return pick(row)
  } catch {
    return DEFAULTS
  }
})

export async function updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const row = await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: patch,
    create: { id: 'singleton', ...DEFAULTS, ...patch },
  })
  return pick(row)
}
