'use server'

import { signIn } from '@/auth'
import { AuthError } from 'next-auth'

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string }

export async function loginAction(_prev: LoginResult | null, formData: FormData): Promise<LoginResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) return { ok: false, error: 'Email and password required.' }

  try {
    await signIn('credentials', { email, password, redirect: false })
    return { ok: true }
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === 'CredentialsSignin') {
        return { ok: false, error: 'Email or password incorrect.' }
      }
    }
    // Don't leak internals
    return { ok: false, error: 'Sign in failed. Try again in a moment.' }
  }
}
