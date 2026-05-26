import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { Card, CardBody } from '@/components/ui/Card'
import { SignupForm } from './SignupForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sign up' }

export default async function SignupPage() {
  const session = await auth()
  if (session?.user) redirect('/account')

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-100">Create an account</h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Save your blends and access them from any device.
            </p>
          </div>
          <SignupForm />
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-amber-700 hover:underline dark:text-amber-500">
              Sign in
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
