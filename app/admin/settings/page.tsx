import { getSettings } from '@/lib/settings'
import { saveSettings } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Settings — Admin' }

export default async function AdminSettingsPage() {
  const settings = await getSettings()

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">Site Settings</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Toggles that take effect immediately across the public site.
        </p>
      </div>

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

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  )
}

function ToggleField({
  name,
  defaultChecked,
  label,
  description,
}: {
  name: string
  defaultChecked: boolean
  label: string
  description: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-4">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-5 w-5 cursor-pointer rounded border-stone-300 text-amber-700 focus:ring-amber-500 dark:border-stone-600"
      />
      <div className="flex-1">
        <div className="font-medium text-stone-800 dark:text-stone-200">{label}</div>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{description}</p>
      </div>
    </label>
  )
}
