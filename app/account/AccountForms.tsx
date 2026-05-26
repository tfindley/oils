'use client'

import { useActionState, useTransition } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  updateNameAction,
  changePasswordAction,
  deleteAccountAction,
  type AccountResult,
} from './actions'

export function NameForm({ initialName }: { initialName: string }) {
  const [state, action, pending] = useActionState<AccountResult | null, FormData>(updateNameAction, null)

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Display name</label>
        <Input id="name" name="name" defaultValue={initialName} maxLength={80} />
      </div>
      {state && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {state.ok ? state.message : state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
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
          At least 8 characters. You&apos;ll be signed out everywhere on change.
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
