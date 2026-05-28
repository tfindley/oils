import { notFound } from 'next/navigation'
import { getSettings } from '@/lib/settings'
import { AdminLoginForm } from './AdminLoginForm'

export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  const settings = await getSettings()
  const forceLegacy = process.env.FORCE_LEGACY_ADMIN_LOGIN === '1'

  // When legacy admin login is disabled and the emergency override isn't set,
  // hide this page entirely — return 404 so the form isn't even discoverable.
  if (!settings.legacyAdminEnabled && !forceLegacy) {
    notFound()
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-4xl">🌿</span>
          <h1 className="mt-3 font-serif text-2xl font-bold text-stone-900 dark:text-stone-100">Admin Access</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Enter the legacy admin secret to continue.</p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  )
}
