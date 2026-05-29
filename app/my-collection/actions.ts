'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export type CollectionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string }

// --- add to collection ---

export async function addToCollectionAction(oilId: string): Promise<CollectionResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Sign in to add to your collection.' }
  if (!oilId) return { ok: false, error: 'No oil specified.' }

  // Validate the oil exists before insert so we return a clean error rather
  // than letting Prisma throw a foreign-key violation.
  const oil = await prisma.oil.findUnique({ where: { id: oilId }, select: { id: true } })
  if (!oil) return { ok: false, error: 'Oil not found.' }

  try {
    await prisma.userOilCollection.create({
      data: { userId: session.user.id, oilId },
    })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    // P2002 = unique constraint on (userId, oilId). Already in collection.
    if (code === 'P2002') return { ok: false, error: 'Already in your collection.' }
    throw e
  }

  revalidatePath('/my-collection')
  revalidatePath(`/oils/${oilId}`)
  return { ok: true, message: 'Added to your collection.' }
}

// --- remove from collection ---

export async function removeFromCollectionAction(oilId: string): Promise<CollectionResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Sign in first.' }
  if (!oilId) return { ok: false, error: 'No oil specified.' }

  // Scoped delete: only deletes the row belonging to the calling user, so
  // there's no way to delete someone else's entry by guessing IDs.
  const { count } = await prisma.userOilCollection.deleteMany({
    where: { userId: session.user.id, oilId },
  })
  if (count === 0) return { ok: false, error: 'Not in your collection.' }

  revalidatePath('/my-collection')
  revalidatePath(`/oils/${oilId}`)
  return { ok: true, message: 'Removed from your collection.' }
}

// --- update inventory metadata (quantity / opened / expiry / supplier / cost / batch / notes) ---

const UpdateSchema = z.object({
  oilId: z.string().min(1),
  quantity: z.number().min(0).max(10_000).nullable().optional(),
  bottleSizeMl: z.number().min(0).max(10_000).nullable().optional(),
  openedAt: z.string().nullable().optional(),     // ISO date string or null
  expiresAt: z.string().nullable().optional(),
  supplier: z.string().max(200).nullable().optional(),
  cost: z.number().min(0).max(100_000).nullable().optional(),
  batchNo: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

function parseDate(raw: string | null | undefined): Date | null | undefined {
  if (raw === undefined) return undefined  // not in the patch — leave alone
  if (raw === null || raw === '') return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export async function updateCollectionEntryAction(
  _prev: CollectionResult | null,
  formData: FormData,
): Promise<CollectionResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Sign in first.' }

  // FormData fields → typed object. Empty strings become null so the
  // user can clear a field via the form.
  function readFloat(name: string): number | null | undefined {
    const v = formData.get(name)
    if (v === null) return undefined
    const s = v.toString().trim()
    if (s === '') return null
    const n = Number(s)
    return Number.isFinite(n) ? n : undefined
  }
  function readString(name: string): string | null | undefined {
    const v = formData.get(name)
    if (v === null) return undefined
    const s = v.toString().trim()
    return s === '' ? null : s
  }

  const parsed = UpdateSchema.safeParse({
    oilId: formData.get('oilId'),
    quantity: readFloat('quantity'),
    bottleSizeMl: readFloat('bottleSizeMl'),
    openedAt: readString('openedAt'),
    expiresAt: readString('expiresAt'),
    supplier: readString('supplier'),
    cost: readFloat('cost'),
    batchNo: readString('batchNo'),
    notes: readString('notes'),
  })
  if (!parsed.success) return { ok: false, error: 'Invalid input.' }

  const data: Record<string, unknown> = {}
  if (parsed.data.quantity !== undefined) data.quantity = parsed.data.quantity
  if (parsed.data.bottleSizeMl !== undefined) data.bottleSizeMl = parsed.data.bottleSizeMl
  const openedAt = parseDate(parsed.data.openedAt)
  if (openedAt !== undefined) data.openedAt = openedAt
  const expiresAt = parseDate(parsed.data.expiresAt)
  if (expiresAt !== undefined) data.expiresAt = expiresAt
  if (parsed.data.supplier !== undefined) data.supplier = parsed.data.supplier
  if (parsed.data.cost !== undefined) data.cost = parsed.data.cost
  if (parsed.data.batchNo !== undefined) data.batchNo = parsed.data.batchNo
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes

  // Same scoped-update trick as removeFromCollectionAction — the where matches
  // only the caller's row.
  const { count } = await prisma.userOilCollection.updateMany({
    where: { userId: session.user.id, oilId: parsed.data.oilId },
    data,
  })
  if (count === 0) return { ok: false, error: 'Not in your collection.' }

  revalidatePath('/my-collection')
  return { ok: true, message: 'Saved.' }
}
