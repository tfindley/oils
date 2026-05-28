import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ProfileForm, DisplayNameForm, PasswordForm, DeleteAccount } from './AccountForms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Account' }

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true, name: true, email: true, emailVerified: true },
  })
  if (!user) redirect('/login')

  const profileIncomplete = !user.firstName || !user.lastName

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">Account</h1>

      {!user.emailVerified && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Your email isn&apos;t verified yet. Check your inbox for the verification link.
        </div>
      )}

      {profileIncomplete && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Please complete your profile — first and last name are required.
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">Profile</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">Email</p>
            <p className="font-mono text-sm text-stone-800 dark:text-stone-200">{user.email}</p>
          </div>
          <ProfileForm firstName={user.firstName} lastName={user.lastName} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">Display name</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            How your name appears on saved blends and shared links.
          </p>
        </CardHeader>
        <CardBody>
          <DisplayNameForm
            firstName={user.firstName}
            lastName={user.lastName}
            currentName={user.name ?? ''}
          />
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
