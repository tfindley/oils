'use server'

import { revalidatePath } from 'next/cache'
import { updateSettings } from '@/lib/settings'

export async function saveSettings(formData: FormData): Promise<void> {
  await updateSettings({
    tooltipsEnabled: formData.get('tooltipsEnabled') === 'on',
    issueReportingEnabled: formData.get('issueReportingEnabled') === 'on',
    allowAnonymousSaves: formData.get('allowAnonymousSaves') === 'on',
  })
  // Settings affect the public site (footer, every page with a hint), so
  // revalidate broadly. Cheap on this app — almost everything is force-dynamic.
  revalidatePath('/', 'layout')
}
