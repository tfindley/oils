import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { Card, CardBody } from '@/components/ui/Card'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sign in' }

const ERROR_MESSAGES: Record<string, string> = {
  'invalid-token': 'That verification link is invalid. Try signing up again or requesting a fresh link.',
  'expired-token': 'That verification link has expired. Sign in to request a new one.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ verified?: string; email?: string; error?: string; check?: string; passwordChanged?: string }> }) {
  const session = await auth()
  if (session?.user) redirect('/account')

  const params = await searchParams
  const justVerified = params.verified === '1'
  const passwordChanged = params.passwordChanged === '1'
  const checkEmail = params.check === 'email'
  const errorMsg = params.error ? ERROR_MESSAGES[params.error] : undefined
  const prefillEmail = params.email ?? ''

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-100">Sign in</h1>
          </div>

          {justVerified && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              Email verified. Sign in to continue.
            </div>
          )}
          {passwordChanged && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              Password updated. Sign in with your new password.
            </div>
          )}
          {checkEmail && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Please check your email for a verification link before signing in.
            </div>
          )}
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {errorMsg}
            </div>
          )}

          <LoginForm prefillEmail={prefillEmail} />

          <div className="flex items-center justify-between text-sm text-stone-500 dark:text-stone-400">
            <Link href="/forgot-password" className="hover:underline">Forgot password?</Link>
            <Link href="/signup" className="hover:underline">Create account</Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
