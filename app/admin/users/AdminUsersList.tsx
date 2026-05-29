'use client'

import { useState, useTransition } from 'react'
import {
  promoteUserAction,
  demoteUserAction,
  verifyUserEmailAction,
  deleteUserAction,
  toggleExemptUserAction,
  type UserActionResult,
} from './actions'
import { relativeTime, formatShortDate } from '@/lib/format-time'

interface UserRow {
  id: string
  email: string
  name: string | null
  firstName: string
  lastName: string
  role: 'USER' | 'ADMIN'
  emailVerified: string | null
  createdAt: string
  lastSignInAt: string | null
  purgeExempt: boolean
  purgeWarningSentAt: string | null
  purgeFinalWarningSentAt: string | null
  _count: { blends: number }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return 'never'
  return relativeTime(new Date(iso))
}

export function AdminUsersList({ users }: { users: UserRow[] }) {
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const q = query.trim().toLowerCase()
  const visible = q
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.name ?? '').toLowerCase().includes(q) ||
          (u.firstName + ' ' + u.lastName).toLowerCase().includes(q),
      )
    : users

  function run(userId: string, fn: (id: string) => Promise<UserActionResult>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setBusyId(userId)
    setMessage(null)
    startTransition(async () => {
      const result = await fn(userId)
      setBusyId(null)
      if (result.ok) {
        setMessage({ kind: 'ok', text: result.message ?? 'Done.' })
      } else {
        setMessage({ kind: 'err', text: result.error })
      }
    })
  }


  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email, name…"
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base sm:w-72 sm:text-sm focus:border-amber-500 focus:outline-none dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
        />
        <span className="text-xs text-stone-500 dark:text-stone-400">
          {q ? `Showing ${visible.length} of ${users.length}` : `${users.length} user${users.length === 1 ? '' : 's'}`}
        </span>
        {message && (
          <span className={`ml-auto text-sm ${message.kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {message.text}
          </span>
        )}
      </div>

      {/* Mobile: card list */}
      <ul className="space-y-2 sm:hidden">
        {visible.length === 0 && (
          <li className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-500">
            {users.length === 0 ? 'No users yet.' : 'No users match your search.'}
          </li>
        )}
        {visible.map((u) => (
          <li key={u.id} className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-stone-900 dark:text-stone-100">{u.email}</div>
                <div className="truncate text-xs text-stone-500 dark:text-stone-400">{(u.name ?? `${u.firstName} ${u.lastName}`.trim()) || 'No display name'}</div>
              </div>
              <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                u.role === 'ADMIN'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-300'
              }`}>{u.role}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
              <span>{u._count.blends} blend{u._count.blends === 1 ? '' : 's'}</span>
              <span>Email {u.emailVerified ? '✓ verified' : '⏳ unverified'}</span>
              <span>Last sign-in: {fmtRelative(u.lastSignInAt)}</span>
              <span>Joined {formatShortDate(u.createdAt)}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {u.purgeExempt && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" title="Exempt from auto-purge">🛡 Exempt</span>
              )}
              {u.purgeFinalWarningSentAt && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300" title="Final purge warning sent">⚠ Final warning</span>
              )}
              {!u.purgeFinalWarningSentAt && u.purgeWarningSentAt && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300" title="Purge warning sent">⚠ Warned</span>
              )}
            </div>
            <UserActions user={u} busy={pending && busyId === u.id} onRun={run} />
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-xl border border-stone-200 bg-white sm:block dark:border-stone-700 dark:bg-stone-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left dark:border-stone-700 dark:bg-stone-900">
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Email</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Name</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Role</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Verified</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Blends</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Last sign-in</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Joined</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Status</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-stone-400 dark:text-stone-500">
                  {users.length === 0 ? 'No users yet.' : 'No users match your search.'}
                </td>
              </tr>
            )}
            {visible.map((u) => (
              <tr key={u.id} className="hover:bg-stone-50 dark:hover:bg-stone-700/50">
                <td className="px-3 py-2.5 font-mono text-xs text-stone-700 dark:text-stone-300">{u.email}</td>
                <td className="px-3 py-2.5 text-stone-700 dark:text-stone-300">{(u.name ?? `${u.firstName} ${u.lastName}`.trim()) || '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    u.role === 'ADMIN'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-300'
                  }`}>{u.role}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-stone-500 dark:text-stone-400">
                  {u.emailVerified ? <span className="text-emerald-600 dark:text-emerald-500">✓ verified</span> : <span className="text-amber-600 dark:text-amber-500">⏳ unverified</span>}
                </td>
                <td className="px-3 py-2.5 text-stone-500 dark:text-stone-400">{u._count.blends}</td>
                <td className="px-3 py-2.5 text-xs text-stone-500 dark:text-stone-400">{fmtRelative(u.lastSignInAt)}</td>
                <td className="px-3 py-2.5 text-xs text-stone-400 dark:text-stone-500">{formatShortDate(u.createdAt)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {u.purgeExempt && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" title="Exempt from auto-purge">🛡</span>
                    )}
                    {u.purgeFinalWarningSentAt && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300" title="Final purge warning sent">⚠ final</span>
                    )}
                    {!u.purgeFinalWarningSentAt && u.purgeWarningSentAt && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300" title="Purge warning sent">⚠</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <UserActions user={u} busy={pending && busyId === u.id} onRun={run} inline />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UserActions({
  user,
  busy,
  onRun,
  inline = false,
}: {
  user: UserRow
  busy: boolean
  inline?: boolean
  onRun: (userId: string, fn: (id: string) => Promise<UserActionResult>, confirmMsg?: string) => void
}) {
  const containerClass = inline
    ? 'flex flex-wrap items-center justify-end gap-1.5'
    : 'mt-3 flex flex-wrap gap-2'

  const buttonClass =
    'rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className={containerClass}>
      {user.role === 'USER' ? (
        <button
          type="button"
          onClick={() => onRun(user.id, promoteUserAction)}
          disabled={busy}
          className={`${buttonClass} border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950`}
        >
          Promote to admin
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onRun(user.id, demoteUserAction, `Demote ${user.email} to standard user?`)}
          disabled={busy}
          className={`${buttonClass} border-stone-300 text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700`}
        >
          Demote
        </button>
      )}

      {!user.emailVerified && (
        <button
          type="button"
          onClick={() => onRun(user.id, verifyUserEmailAction)}
          disabled={busy}
          className={`${buttonClass} border-stone-300 text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700`}
        >
          Mark verified
        </button>
      )}

      <button
        type="button"
        onClick={() => onRun(user.id, toggleExemptUserAction)}
        disabled={busy}
        className={`${buttonClass} ${
          user.purgeExempt
            ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950'
            : 'border-stone-300 text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700'
        }`}
        title={user.purgeExempt ? 'Click to remove auto-purge exemption' : 'Click to exempt from auto-purge'}
      >
        {user.purgeExempt ? '🛡 Exempt' : 'Make exempt'}
      </button>

      <button
        type="button"
        onClick={() =>
          onRun(user.id, deleteUserAction, `Delete ${user.email}? Their blends become anonymous; sessions drop. Cannot be undone.`)
        }
        disabled={busy}
        className={`${buttonClass} border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950`}
      >
        Delete
      </button>
    </div>
  )
}
