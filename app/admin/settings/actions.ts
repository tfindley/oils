'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSettings, updateSettings } from '@/lib/settings'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'

export type MaintenanceResult =
  | { ok: true; enabled: boolean }
  | { ok: false; error: string }

// Dedicated action for the maintenance-mode toggle. Separate from saveSettings
// so the client component can drive it through a confirmation dialog rather
// than bundling it with the cosmetic toggles.
export async function toggleMaintenanceModeAction(enabled: boolean): Promise<MaintenanceResult> {
  if (!(await isAdminAuthenticated())) return { ok: false, error: 'Not authorized.' }
  await updateSettings({ maintenanceMode: enabled })
  // Public site state just flipped — revalidate broadly so the maintenance
  // gate kicks in immediately for the next request from the writing process.
  revalidatePath('/', 'layout')
  revalidatePath('/admin/settings')
  return { ok: true, enabled }
}

export async function saveSettings(formData: FormData): Promise<void> {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const wantLegacyEnabled = formData.get('legacyAdminEnabled') === 'on'

  // Lockout guard: refuse to disable legacy admin if there are no ADMIN-role
  // users to take over. The Settings UI mirrors this check, but enforce here
  // for safety against direct POSTs.
  if (!wantLegacyEnabled) {
    const current = await getSettings()
    if (current.legacyAdminEnabled) {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
      if (adminCount === 0) {
        redirect('/admin/settings?error=no-admin')
      }
    }
  }

  // Note: maintenanceMode is intentionally NOT touched here — it has its own
  // dedicated action (toggleMaintenanceModeAction) driven by MaintenanceModeCard
  // so it goes through a confirmation dialog. Saving the cosmetic toggles must
  // not clobber whatever maintenance state is currently set.
  await updateSettings({
    tooltipsEnabled: formData.get('tooltipsEnabled') === 'on',
    issueReportingEnabled: formData.get('issueReportingEnabled') === 'on',
    allowAnonymousSaves: formData.get('allowAnonymousSaves') === 'on',
    legacyAdminEnabled: wantLegacyEnabled,
  })
  // Settings affect the public site (footer, every page with a hint), so
  // revalidate broadly. Cheap on this app — almost everything is force-dynamic.
  revalidatePath('/', 'layout')
  redirect('/admin/settings?saved=1')
}
