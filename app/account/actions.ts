'use server'

import { z } from 'zod'
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'

export type AccountResult = { ok: true; message?: string } | { ok: false; error: string }

const NameSchema = z.object({ name: z.string().max(80) })

export async function updateNameAction(_prev: AccountResult | null, formData: FormData): Promise<AccountResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Not signed in.' }

  const parsed = NameSchema.safeParse({ name: formData.get('name') ?? '' })
  if (!parsed.success) return { ok: false, error: 'Name must be 80 characters or fewer.' }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name || null },
  })
  revalidatePath('/account')
  return { ok: true, message: 'Name updated.' }
}

const PasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
})

export async function changePasswordAction(_prev: AccountResult | null, formData: FormData): Promise<AccountResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Not signed in.' }

  const parsed = PasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
  })
  if (!parsed.success) return { ok: false, error: 'Check the current and new password (min 8 characters).' }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  })
  if (!user?.passwordHash) {
    return { ok: false, error: 'This account does not have a password set. Use the forgot-password flow.' }
  }

  const valid = await argon2Verify(user.passwordHash, parsed.data.currentPassword)
  if (!valid) return { ok: false, error: 'Current password incorrect.' }

  const newHash = await argon2Hash(parsed.data.newPassword)
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash: newHash } })

  // With JWT sessions, the current cookie remains valid until it expires.
  // We sign the user out so they're prompted to re-enter their new password
  // (matches normal user expectation). Other devices keep working until their
  // JWT expires (default 30 days) — known limitation, fix is a passwordVersion
  // mechanism in a future patch.
  await signOut({ redirect: false })
  redirect('/login?passwordChanged=1')
}

export async function deleteAccountAction(): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  await prisma.user.delete({ where: { id: session.user.id } })
  // Cascade deletes sessions/accounts. Blends owned by this user will be
  // handled in v1.2.0 when Blend.userId exists (cascade to anonymous).
  await signOut({ redirect: false })
  redirect('/?accountDeleted=1')
}
