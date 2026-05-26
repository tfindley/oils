'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { forgotPasswordAction, type ForgotResult } from './actions'

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotResult | null, FormData>(forgotPasswordAction, null)

  if (state?.ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
        <p className="font-semibold">Check your email.</p>
        <p className="mt-1">If an account exists with that email, we&apos;ve sent a reset link.</p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Email</label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {state && !state.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  )
}
