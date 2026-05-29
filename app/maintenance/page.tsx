export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Maintenance',
  description: 'The site is temporarily offline for maintenance.',
  robots: { index: false, follow: false },
}

// Rendered when proxy.ts rewrites a public-route request because
// Settings.maintenanceMode is true. The URL the user typed stays in their
// address bar (proxy.rewrite, not redirect) so a refresh lands them back on
// their original page when maintenance ends.

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Oil Blender'

export default function MaintenancePage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 text-6xl">🌿</div>
      <h1 className="mb-3 font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">
        {SITE_NAME} is updating
      </h1>
      <p className="mb-6 text-lg text-stone-600 dark:text-stone-300">
        We&apos;re making some changes behind the scenes. Please check back in a few minutes.
      </p>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Refreshing this page when we&apos;re back online will take you to where you were headed.
      </p>
    </div>
  )
}
