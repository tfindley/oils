'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export type BlendActionResult = { ok: true; message?: string } | { ok: false; error: string }

// Owner toggles whether their blend is publicly accessible via its URL.
// Anonymous blends (userId == null) ignore this — they're always public.
export async function setShareAction(blendId: string, isShared: boolean): Promise<BlendActionResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Not signed in.' }

  const blend = await prisma.blend.findUnique({
    where: { id: blendId },
    select: { userId: true },
  })
  if (!blend) return { ok: false, error: 'Blend not found.' }
  if (blend.userId !== session.user.id) return { ok: false, error: 'You do not own this blend.' }

  await prisma.blend.update({ where: { id: blendId }, data: { isShared } })
  revalidatePath(`/blend/${blendId}`)
  revalidatePath('/my-blends')
  return { ok: true, message: isShared ? 'Now shared.' : 'Made private.' }
}

// Authenticated user claims ownership of an unowned (anonymous) blend.
// URL-only auth: if you have the URL and the blend has no owner, you can claim
// it. Matches the implicit contract of anonymous blends pre-v1.2.
export async function claimBlendAction(blendId: string): Promise<BlendActionResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Sign in first.' }

  // Atomic claim: scope the update to userId == null so concurrent claims
  // can't both succeed. updateMany returns count=0 when the row is missing
  // or already owned; either way, no claim happens for this caller.
  // Claiming preserves the existing access pattern: anonymous blends are
  // public by URL, so the newly-claimed blend stays public (isShared = true).
  const { count } = await prisma.blend.updateMany({
    where: { id: blendId, userId: null },
    data: { userId: session.user.id, isShared: true },
  })
  if (count === 0) {
    // Don't leak whether the blend exists vs. is already owned.
    return { ok: false, error: 'This blend can no longer be claimed.' }
  }
  revalidatePath(`/blend/${blendId}`)
  revalidatePath('/my-blends')
  return { ok: true, message: 'Claimed.' }
}
