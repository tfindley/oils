'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSettings, updateSettings } from '@/lib/settings'
import { prisma } from '@/lib/prisma'

export async function saveSettings(formData: FormData): Promise<void> {
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
