import { redirect } from 'next/navigation'
import { Card, CardBody } from '@/components/ui/Card'
import { ResetPasswordForm } from './ResetPasswordForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reset password' }

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  if (!token) redirect('/forgot-password')

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-100">Set a new password</h1>
          </div>
          <ResetPasswordForm token={token} />
        </CardBody>
      </Card>
    </div>
  )
}
