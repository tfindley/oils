'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { signupAction, type SignupResult } from './actions'

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupResult | null, FormData>(signupAction, null)

  if (state?.ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
        <p className="font-semibold">Check your email.</p>
        <p className="mt-1">If an account with that email doesn&apos;t already exist, we&apos;ve sent a verification link.</p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">First name</label>
          <Input id="firstName" name="firstName" autoComplete="given-name" required maxLength={50} />
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Last name</label>
          <Input id="lastName" name="lastName" autoComplete="family-name" required maxLength={50} />
        </div>
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Email</label>
        <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Password</label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">At least 8 characters.</p>
      </div>
      {state && !state.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}
