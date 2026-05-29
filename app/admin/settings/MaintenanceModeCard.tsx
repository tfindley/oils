'use client'

import { useState, useTransition } from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { toggleMaintenanceModeAction } from './actions'

// Dedicated card for the maintenance-mode toggle. Separated from the cosmetic
// settings toggles because:
//   • Engaging it is consequential (takes the public site offline)
//   • It needs a confirmation dialog
//   • It carries non-trivial recovery / access information the operator
//     should read before flipping the switch
//
// State flow: optimistic flip on success, rollback on error. The server
// action also calls revalidatePath so the next render reflects the new state.

export function MaintenanceModeCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  function handleToggle(next: boolean) {
    if (next === enabled || pending) return
    if (next) {
      const confirmed = confirm(
        'Engage maintenance mode?\n\n' +
        'This will:\n' +
        '  • Show a "we are updating" page to every public visitor\n' +
        '  • Block sign-up, sign-in, blend saves, and all public API requests\n' +
        '  • Keep /admin/* reachable so you can disable it again\n' +
        '  • Keep cron jobs (/api/cron/*) running\n' +
        '  • Keep Auth.js handlers (/api/auth/*) running\n\n' +
        'Continue?',
      )
      if (!confirmed) return
    }
    setMessage(null)
    startTransition(async () => {
      const r = await toggleMaintenanceModeAction(next)
      if (r.ok) {
        setEnabled(r.enabled)
        setMessage({
          kind: 'ok',
          text: r.enabled
            ? 'Maintenance mode engaged. Public visitors now see the /maintenance page.'
            : 'Maintenance mode disabled. Public site is reachable again.',
        })
      } else {
        setMessage({ kind: 'err', text: r.error })
      }
    })
  }

  return (
    <Card
      className={
        enabled
          ? 'border-amber-300 dark:border-amber-700'
          : undefined
      }
    >
      <CardHeader>
        <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">
          Maintenance mode
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Take the public site offline around risky deploys, schema changes, or anything that might leave the site briefly broken.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Status banner */}
        {enabled ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            ⚠ <strong>Maintenance mode is ON.</strong> Public visitors see the /maintenance page. Only the admin panel and `/api/cron/*` are reachable.
          </div>
        ) : (
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-300">
            Currently <strong>off</strong>. The public site is live.
          </div>
        )}

        {/* Background info */}
        <details className="rounded-md border border-stone-200 px-3 py-2 dark:border-stone-700">
          <summary className="cursor-pointer text-sm font-medium text-stone-700 dark:text-stone-300">
            What does maintenance mode do?
          </summary>
          <div className="mt-2 space-y-2 text-sm text-stone-600 dark:text-stone-400">
            <p>
              When ON, the Next.js proxy intercepts every request to a public route and rewrites it to a friendly{' '}
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-xs dark:bg-stone-800">/maintenance</code>
              {' '}page. The user&apos;s original URL stays in their address bar, so refreshing once you&apos;re back online lands them on the page they were going to.
            </p>
            <p>What stays online:</p>
            <ul className="list-inside list-disc space-y-1 pl-1">
              <li><code className="font-mono text-xs">/admin/*</code> — your operator escape hatch (this page)</li>
              <li><code className="font-mono text-xs">/maintenance</code> — the rewrite target itself</li>
              <li><code className="font-mono text-xs">/api/auth/*</code> — NextAuth handlers (so your admin session keeps working)</li>
              <li><code className="font-mono text-xs">/api/cron/*</code> — bearer-auth&apos;d cron jobs (anonymous-blend purge, account purge)</li>
              <li>Static assets — favicons, images, Next.js bundles</li>
            </ul>
            <p>What&apos;s blocked:</p>
            <ul className="list-inside list-disc space-y-1 pl-1">
              <li>All public pages (homepage, /blend, /oils, /blends, /signup, /login, /account, /my-blends, /my-collection, …)</li>
              <li>Public APIs (/api/blends, etc.) — these return <code className="font-mono text-xs">503</code> JSON with a <code className="font-mono text-xs">Retry-After</code> header</li>
            </ul>
          </div>
        </details>

        {/* Access info */}
        <details className="rounded-md border border-stone-200 px-3 py-2 dark:border-stone-700">
          <summary className="cursor-pointer text-sm font-medium text-stone-700 dark:text-stone-300">
            How do I access the site once maintenance is engaged?
          </summary>
          <div className="mt-2 space-y-2 text-sm text-stone-600 dark:text-stone-400">
            <p>The admin panel stays open through either auth path:</p>
            <ol className="list-inside list-decimal space-y-1 pl-1">
              <li>
                <strong>Your existing ADMIN session</strong> — if you&apos;re signed in as a User with role <code className="font-mono text-xs">ADMIN</code>, you can keep browsing <code className="font-mono text-xs">/admin/*</code> normally.
              </li>
              <li>
                <strong>Legacy admin login</strong> — visit <code className="font-mono text-xs">/admin/login</code> and enter your <code className="font-mono text-xs">ADMIN_SECRET</code>. (Hidden if you previously disabled the legacy toggle below — see emergency recovery.)
              </li>
            </ol>
            <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              <strong>Emergency recovery</strong>: if you lose user-based admin access (lost password, etc.) AND the legacy toggle is also off, set{' '}
              <code className="font-mono">FORCE_LEGACY_ADMIN_LOGIN=1</code> in the container env and restart. The legacy login form reappears regardless of the toggle.
            </p>
          </div>
        </details>

        {/* Disable info */}
        <details className="rounded-md border border-stone-200 px-3 py-2 dark:border-stone-700">
          <summary className="cursor-pointer text-sm font-medium text-stone-700 dark:text-stone-300">
            How do I disable maintenance mode afterwards?
          </summary>
          <div className="mt-2 space-y-2 text-sm text-stone-600 dark:text-stone-400">
            <p>
              Come back to this card (you&apos;ll need an admin session per &ldquo;How do I access&rdquo; above), un-tick the checkbox below, and the public site is reachable again immediately.
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-500">
              Note: <code className="font-mono text-xs">Settings</code> are cached in-process for 30 seconds. The writing process sees changes immediately; if you run multiple containers, other instances may take up to 30s to pick up the new value.
            </p>
          </div>
        </details>

        {/* The actual toggle */}
        <label
          className={`flex cursor-pointer items-start gap-4 ${
            pending ? 'cursor-not-allowed opacity-60' : ''
          }`}
        >
          <input
            type="checkbox"
            checked={enabled}
            disabled={pending}
            onChange={(e) => handleToggle(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-stone-300 text-amber-700 focus:ring-amber-500 disabled:cursor-not-allowed dark:border-stone-600"
          />
          <div className="flex-1">
            <div className="font-medium text-stone-800 dark:text-stone-200">
              {enabled ? 'Maintenance mode is ENGAGED — un-check to disable' : 'Engage maintenance mode'}
            </div>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {enabled
                ? 'Click to bring the public site back online.'
                : 'Click to take the public site offline. You will be asked to confirm.'}
            </p>
          </div>
        </label>

        {/* Status / error message */}
        {message && (
          <p
            className={`text-sm ${
              message.kind === 'ok'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {message.text}
          </p>
        )}
      </CardBody>
    </Card>
  )
}
