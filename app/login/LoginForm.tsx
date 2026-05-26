'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { loginAction, type LoginResult } from './actions'

export function LoginForm({ prefillEmail = '' }: { prefillEmail?: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState<LoginResult | null, FormData>(loginAction, null)

  useEffect(() => {
    if (state?.ok) {
      router.push('/account')
      router.refresh()
    }
  }, [state, router])

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Email</label>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={prefillEmail} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">Password</label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state && !state.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
