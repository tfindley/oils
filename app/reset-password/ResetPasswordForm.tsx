'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { resetPasswordAction, type ResetResult } from './actions'

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetResult | null, FormData>(resetPasswordAction, null)

  if (state?.ok) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p className="font-semibold">Password updated.</p>
          <p className="mt-1">All existing sessions were signed out. Sign in with your new password.</p>
        </div>
        <Link href="/login" className="block">
          <Button className="w-full">Go to sign in</Button>
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">New password</label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">At least 8 characters.</p>
      </div>
      {state && !state.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  )
}
