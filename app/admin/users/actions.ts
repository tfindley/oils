'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

export type UserActionResult = { ok: true; message?: string } | { ok: false; error: string }

async function adminCount(): Promise<number> {
  return prisma.user.count({ where: { role: 'ADMIN' } })
}

export async function promoteUserAction(userId: string): Promise<UserActionResult> {
  if (!userId) return { ok: false, error: 'No user id.' }
  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } })
  revalidatePath('/admin/users')
  return { ok: true, message: 'User promoted to admin.' }
}

export async function demoteUserAction(userId: string): Promise<UserActionResult> {
  if (!userId) return { ok: false, error: 'No user id.' }

  // Lockout guard — refuse to demote the last remaining admin.
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!target) return { ok: false, error: 'User not found.' }
  if (target.role !== 'ADMIN') return { ok: false, error: 'User is not an admin.' }

  const admins = await adminCount()
  if (admins <= 1) {
    return { ok: false, error: 'Cannot demote the last remaining admin. Promote another user first.' }
  }

  await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } })
  revalidatePath('/admin/users')
  return { ok: true, message: 'User demoted to standard user.' }
}

export async function verifyUserEmailAction(userId: string): Promise<UserActionResult> {
  if (!userId) return { ok: false, error: 'No user id.' }
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } })
  revalidatePath('/admin/users')
  return { ok: true, message: 'Email manually marked verified.' }
}

export async function deleteUserAction(userId: string): Promise<UserActionResult> {
  if (!userId) return { ok: false, error: 'No user id.' }

  // Lockout guard — refuse to delete the last remaining admin.
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!target) return { ok: false, error: 'User not found.' }
  if (target.role === 'ADMIN') {
    const admins = await adminCount()
    if (admins <= 1) {
      return { ok: false, error: 'Cannot delete the last remaining admin. Promote another user first.' }
    }
  }

  // Cascade: their blends become anonymous (FK is SET NULL); sessions/accounts drop.
  await prisma.user.delete({ where: { id: userId } })
  revalidatePath('/admin/users')
  return { ok: true, message: 'User deleted. Their blends are now anonymous.' }
}
