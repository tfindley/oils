import Link from 'next/link'
import { Card, CardBody } from '@/components/ui/Card'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Forgot password' }

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-100">Reset your password</h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Enter your email and we&apos;ll send you a link to reset.
            </p>
          </div>
          <ForgotPasswordForm />
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Remembered it?{' '}
            <Link href="/login" className="font-medium text-amber-700 hover:underline dark:text-amber-500">
              Back to sign in
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
