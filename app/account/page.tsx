import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { NameForm, PasswordForm, DeleteAccount } from './AccountForms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Account' }

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = {
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    emailVerified: !!session.user.emailVerified,
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">Account</h1>

      {!user.emailVerified && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Your email isn&apos;t verified yet. Check your inbox for the verification link.
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">Profile</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">Email</p>
            <p className="font-mono text-sm text-stone-800 dark:text-stone-200">{user.email}</p>
          </div>
          <NameForm initialName={user.name} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">Change password</h2>
        </CardHeader>
        <CardBody>
          <PasswordForm />
        </CardBody>
      </Card>

      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <h2 className="font-serif text-lg font-semibold text-red-700 dark:text-red-400">Delete account</h2>
        </CardHeader>
        <CardBody>
          <DeleteAccount />
        </CardBody>
      </Card>
    </div>
  )
}
