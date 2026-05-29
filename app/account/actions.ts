'use server'

import { z } from 'zod'
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'
import { formatDisplayName } from './display-name'
import { isSupportedCurrency, DEFAULT_CURRENCY } from '@/lib/currency'

export type AccountResult = { ok: true; message?: string } | { ok: false; error: string }

const NAME_RE = /^[^\s].*[^\s]$|^[^\s]$/

const ProfileSchema = z.object({
  firstName: z.string().min(1).max(50).regex(NAME_RE),
  lastName: z.string().min(1).max(50).regex(NAME_RE),
  currency: z.string().refine(isSupportedCurrency, 'Unsupported currency.'),
})

export async function updateProfileAction(_prev: AccountResult | null, formData: FormData): Promise<AccountResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Not signed in.' }

  const parsed = ProfileSchema.safeParse({
    firstName: (formData.get('firstName') ?? '').toString().trim(),
    lastName: (formData.get('lastName') ?? '').toString().trim(),
    currency: (formData.get('currency') ?? DEFAULT_CURRENCY).toString(),
  })
  if (!parsed.success) return { ok: false, error: 'First and last name required (max 50 chars each); currency must be one of the supported options.' }

  await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
  })
  revalidatePath('/account')
  revalidatePath('/my-collection')
  return { ok: true, message: 'Profile updated.' }
}

const DisplayNameSchema = z
  .object({
    format: z.enum(['first-last', 'last-first', 'first-l', 'f-last', 'anonymous', 'custom']),
    custom: z.string().max(80).optional(),
  })
  .refine(
    (d) => d.format !== 'custom' || (d.custom && d.custom.trim().length > 0),
    { message: 'Custom display name cannot be empty.' },
  )

export async function updateDisplayNameAction(_prev: AccountResult | null, formData: FormData): Promise<AccountResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Not signed in.' }

  const parsed = DisplayNameSchema.safeParse({
    format: formData.get('format'),
    custom: (formData.get('custom') ?? '').toString().trim() || undefined,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true },
  })
  if (!user) return { ok: false, error: 'Account not found.' }

  const name = formatDisplayName(parsed.data.format, user.firstName, user.lastName, parsed.data.custom)
  await prisma.user.update({ where: { id: session.user.id }, data: { name } })
  revalidatePath('/account')
  return { ok: true, message: 'Display name updated.' }
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

  // Mirror the /admin/users lockout guard: refuse if this is the last ADMIN.
  // Otherwise the site can lose all admin access via self-delete.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (me?.role === 'ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (admins <= 1) {
      redirect('/account?error=last-admin')
    }
  }

  await prisma.user.delete({ where: { id: session.user.id } })
  // Cascade: sessions/accounts drop; blends become anonymous (FK SET NULL).
  await signOut({ redirect: false })
  redirect('/?accountDeleted=1')
}
