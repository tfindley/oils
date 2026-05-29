'use client'

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CURRENCIES } from '@/lib/currency'
import {
  updateProfileAction,
  updateDisplayNameAction,
  changePasswordAction,
  deleteAccountAction,
  type AccountResult,
} from './actions'
import { formatDisplayName, type DisplayFormat } from './display-name'

export function ProfileForm({
  firstName,
  lastName,
  currency,
}: {
  firstName: string
  lastName: string
  currency: string
}) {
  const [state, action, pending] = useActionState<AccountResult | null, FormData>(updateProfileAction, null)

  // Controlled fields. React 19 resets uncontrolled form fields after a
  // server action completes — which made the currency `<select>` appear to
  // revert to its previous value on save, even though the DB was updated.
  // Local state survives the reset; useEffect syncs from props when the
  // server re-renders with the saved value, so the visible UI tracks DB.
  const [firstNameValue, setFirstNameValue] = useState(firstName)
  const [lastNameValue, setLastNameValue] = useState(lastName)
  const [currencyValue, setCurrencyValue] = useState(currency)

  useEffect(() => { setFirstNameValue(firstName) }, [firstName])
  useEffect(() => { setLastNameValue(lastName) }, [lastName])
  useEffect(() => { setCurrencyValue(currency) }, [currency])

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">First name</label>
          <Input
            id="firstName"
            name="firstName"
            value={firstNameValue}
            onChange={(e) => setFirstNameValue(e.target.value)}
            required
            maxLength={50}
            autoComplete="given-name"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Last name</label>
          <Input
            id="lastName"
            name="lastName"
            value={lastNameValue}
            onChange={(e) => setLastNameValue(e.target.value)}
            required
            maxLength={50}
            autoComplete="family-name"
          />
        </div>
      </div>
      <div>
        <label htmlFor="currency" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Currency</label>
        <select
          id="currency"
          name="currency"
          value={currencyValue}
          onChange={(e) => setCurrencyValue(e.target.value)}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base sm:text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-700 dark:text-stone-100"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Used when displaying the cost field in your oil collection. Switching currency does not convert existing values — re-enter them in your new currency if needed.
        </p>
      </div>
      {state && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {state.ok ? state.message : state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save profile'}</Button>
    </form>
  )
}

// Detect which preset matches the current display name so the picker is
// pre-selected correctly when the page first renders.
function detectFormat(currentName: string, firstName: string, lastName: string): DisplayFormat {
  if (currentName === formatDisplayName('anonymous', firstName, lastName)) return 'anonymous'
  if (!firstName || !lastName) return 'custom'
  if (currentName === formatDisplayName('first-last', firstName, lastName)) return 'first-last'
  if (currentName === formatDisplayName('last-first', firstName, lastName)) return 'last-first'
  if (currentName === formatDisplayName('first-l', firstName, lastName)) return 'first-l'
  if (currentName === formatDisplayName('f-last', firstName, lastName)) return 'f-last'
  return 'custom'
}

export function DisplayNameForm({
  firstName,
  lastName,
  currentName,
}: {
  firstName: string
  lastName: string
  currentName: string
}) {
  const [state, action, pending] = useActionState<AccountResult | null, FormData>(updateDisplayNameAction, null)
  const initialFormat = useMemo(() => detectFormat(currentName, firstName, lastName), [currentName, firstName, lastName])
  const [format, setFormat] = useState<DisplayFormat>(initialFormat)
  const [custom, setCustom] = useState(initialFormat === 'custom' ? currentName : '')

  const namePresets: Array<{ id: DisplayFormat; preview: string }> = firstName && lastName
    ? [
        { id: 'first-last', preview: formatDisplayName('first-last', firstName, lastName) },
        { id: 'last-first', preview: formatDisplayName('last-first', firstName, lastName) },
        { id: 'first-l', preview: formatDisplayName('first-l', firstName, lastName) },
        { id: 'f-last', preview: formatDisplayName('f-last', firstName, lastName) },
      ]
    : []

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="format" value={format} />

      <fieldset className="space-y-2">
        <legend className="sr-only">Display name format</legend>

        {namePresets.length === 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Set your first and last name above to enable name-based formats. You can still pick Anonymous or a custom display name.
          </p>
        )}

        {namePresets.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-stone-200 px-3 py-2 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-700/50">
            <input
              type="radio"
              name="format-radio"
              value={p.id}
              checked={format === p.id}
              onChange={() => setFormat(p.id)}
              className="h-4 w-4"
            />
            <span className="text-sm text-stone-800 dark:text-stone-200">{p.preview}</span>
          </label>
        ))}

        <label className="flex cursor-pointer items-center gap-3 rounded-md border border-stone-200 px-3 py-2 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-700/50">
          <input
            type="radio"
            name="format-radio"
            value="anonymous"
            checked={format === 'anonymous'}
            onChange={() => setFormat('anonymous')}
            className="h-4 w-4"
          />
          <span className="text-sm text-stone-800 dark:text-stone-200">Anonymous</span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-200 px-3 py-2 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-700/50">
          <input
            type="radio"
            name="format-radio"
            value="custom"
            checked={format === 'custom'}
            onChange={() => setFormat('custom')}
            className="mt-2 h-4 w-4"
          />
          <div className="flex-1">
            <span className="text-sm text-stone-800 dark:text-stone-200">Custom / nickname</span>
            <Input
              name="custom"
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setFormat('custom') }}
              placeholder="e.g. Tris, T.F., or whatever you like"
              maxLength={80}
              className="mt-2"
            />
          </div>
        </label>
      </fieldset>

      {state && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {state.ok ? state.message : state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save display name'}
      </Button>
    </form>
  )
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<AccountResult | null, FormData>(changePasswordAction, null)

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Current password</label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">New password</label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          At least 8 characters. You&apos;ll be signed out and need to sign in again.
        </p>
      </div>
      {state && !state.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>{pending ? 'Updating…' : 'Update password'}</Button>
    </form>
  )
}

export function DeleteAccount() {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm('Permanently delete your account? This cannot be undone.')) return
    startTransition(() => { deleteAccountAction() })
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-stone-600 dark:text-stone-400">
        Permanently delete your account, sessions, and any saved data tied to it. This cannot be undone.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      >
        {pending ? 'Deleting…' : 'Delete my account'}
      </button>
    </div>
  )
}
