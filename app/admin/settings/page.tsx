import { getSettings } from '@/lib/settings'
import { prisma } from '@/lib/prisma'
import { saveSettings } from './actions'
import { MaintenanceModeCard } from './MaintenanceModeCard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Settings — Admin' }

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [settings, adminCount, params] = await Promise.all([
    getSettings(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    searchParams,
  ])

  const canDisableLegacy = adminCount > 0
  const noAdminError = params.error === 'no-admin'

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">Site Settings</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Toggles that take effect immediately across the public site.
        </p>
      </div>

      {params.saved === '1' && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          Settings saved.
        </div>
      )}
      {noAdminError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          Cannot disable legacy admin login — there are no users with the ADMIN role.
          Promote an account in <a href="/admin/users" className="font-medium underline">Users</a> first.
        </div>
      )}

      <form action={saveSettings} className="space-y-6 rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
        <ToggleField
          name="tooltipsEnabled"
          defaultChecked={settings.tooltipsEnabled}
          label="Help tooltips"
          description="Show the inline hint banners that explain how each tool works (blend builder, oil compare, etc.). Users can still ✕ each one individually; turning this off hides them all."
        />

        <ToggleField
          name="issueReportingEnabled"
          defaultChecked={settings.issueReportingEnabled}
          label="Footer issue-reporting link"
          description={`Show "Found a problem? Report it on GitHub" in the site footer. Turn off if you'd rather not point users at the GitHub repo.`}
        />

        <ToggleField
          name="allowAnonymousSaves"
          defaultChecked={settings.allowAnonymousSaves}
          label="Allow anonymous blend saves"
          description="Let signed-out visitors save blends with public share URLs (the original v1.0 behaviour). Turn off to require a login before saving — useful if you want to track all blend activity to a user."
        />

        <div className="border-t border-stone-200 pt-6 dark:border-stone-700">
          <ToggleField
            name="legacyAdminEnabled"
            defaultChecked={settings.legacyAdminEnabled}
            disabled={!canDisableLegacy && settings.legacyAdminEnabled}
            label="Legacy admin login (ADMIN_SECRET cookie)"
            description={
              canDisableLegacy
                ? `Currently ${settings.legacyAdminEnabled ? 'enabled' : 'disabled'}. Turn OFF once you've confirmed you can access /admin via a user account with the ADMIN role. The legacy login form at /admin/login will return 404 and the ADMIN_SECRET cookie path is rejected. Recoverable in an emergency by setting FORCE_LEGACY_ADMIN_LOGIN=1 in the container env and restarting.`
                : `Cannot disable yet — promote at least one user to ADMIN in the Users page first, then come back here. (Currently ${adminCount} admin user${adminCount === 1 ? '' : 's'}.)`
            }
          />
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            <strong>Current admin users:</strong> {adminCount}.{' '}
            {adminCount === 0 && (
              <span className="text-amber-700 dark:text-amber-500">
                Promote a user in <a href="/admin/users" className="font-medium underline">Users</a> to enable this toggle.
              </span>
            )}
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
          >
            Save changes
          </button>
        </div>
      </form>

      {/* Maintenance mode lives in its own card, separate from the cosmetic
          toggles above. It has its own action + confirmation flow because
          engaging it takes the public site offline. */}
      <div className="mt-6">
        <MaintenanceModeCard initialEnabled={settings.maintenanceMode} />
      </div>
    </div>
  )
}

function ToggleField({
  name,
  defaultChecked,
  label,
  description,
  disabled,
}: {
  name: string
  defaultChecked: boolean
  label: string
  description: string
  disabled?: boolean
}) {
  return (
    <label className={`flex items-start gap-4 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-1 h-5 w-5 cursor-pointer rounded border-stone-300 text-amber-700 focus:ring-amber-500 disabled:cursor-not-allowed dark:border-stone-600"
      />
      <div className="flex-1">
        <div className="font-medium text-stone-800 dark:text-stone-200">{label}</div>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{description}</p>
      </div>
    </label>
  )
}
