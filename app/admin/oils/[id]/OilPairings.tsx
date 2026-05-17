'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePairing, deletePairing, addPairing } from '../../actions'
import { PairingBadge } from '@/components/blend/PairingBadge'
import type { PairingRating } from '@/types'

interface Pairing {
  id: string
  otherId: string
  otherName: string
  rating: PairingRating
  reason: string
}

interface OtherOil {
  id: string
  name: string
}

const RATINGS: PairingRating[] = ['EXCELLENT', 'GOOD', 'CAUTION', 'AVOID', 'UNSAFE']

function RatingSelect({ value, onChange }: { value: PairingRating; onChange: (v: PairingRating) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PairingRating)}
      className="rounded border border-stone-300 bg-white px-2 py-1 text-xs dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
    >
      {RATINGS.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  )
}

function usePairingEdit(oilId: string, pairing: Pairing) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState<PairingRating>(pairing.rating)
  const [reason, setReason] = useState(pairing.reason)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function cancelEdit() {
    setEditing(false)
    setRating(pairing.rating)
    setReason(pairing.reason)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updatePairing(pairing.id, oilId, rating, reason)
      if (res.ok) {
        setEditing(false)
        router.refresh()
      } else {
        setError('Save failed')
      }
    })
  }

  function handleDelete() {
    if (!confirm(`Delete pairing with ${pairing.otherName}?`)) return
    startTransition(async () => {
      await deletePairing(pairing.id, oilId)
      router.refresh()
    })
  }

  return { editing, setEditing, rating, setRating, reason, setReason, pending, error, cancelEdit, handleSave, handleDelete }
}

function PairingRow({ oilId, pairing }: { oilId: string; pairing: Pairing }) {
  const { editing, setEditing, rating, setRating, reason, setReason, pending, error, cancelEdit, handleSave, handleDelete } =
    usePairingEdit(oilId, pairing)

  return (
    <tr className="border-b border-stone-100 dark:border-stone-700">
      <td className="px-3 py-2 text-sm text-stone-800 dark:text-stone-100">{pairing.otherName}</td>
      <td className="px-3 py-2">
        {editing
          ? <RatingSelect value={rating} onChange={setRating} />
          : <PairingBadge rating={pairing.rating} />}
      </td>
      <td className="px-3 py-2">
        {editing ? (
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
          />
        ) : (
          <span className="text-xs text-stone-600 dark:text-stone-400">{pairing.reason}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2">
          {editing ? (
            <>
              <button onClick={handleSave} disabled={pending} className="text-xs text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-500">
                Save
              </button>
              <button onClick={cancelEdit} className="text-xs text-stone-500 hover:underline dark:text-stone-400">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs text-amber-700 hover:underline dark:text-amber-500">
              Edit
            </button>
          )}
          <button onClick={handleDelete} disabled={pending} className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-500">
            Delete
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </td>
    </tr>
  )
}

function PairingCard({ oilId, pairing }: { oilId: string; pairing: Pairing }) {
  const { editing, setEditing, rating, setRating, reason, setReason, pending, error, cancelEdit, handleSave, handleDelete } =
    usePairingEdit(oilId, pairing)

  return (
    <li className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-stone-800 dark:text-stone-100">{pairing.otherName}</span>
        {editing
          ? <RatingSelect value={rating} onChange={setRating} />
          : <PairingBadge rating={pairing.rating} />}
      </div>
      <div className="mt-2">
        {editing ? (
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
          />
        ) : (
          <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-400">{pairing.reason}</p>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {editing ? (
          <>
            <button
              onClick={cancelEdit}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={pending}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Save
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-stone-600 dark:text-amber-500 dark:hover:bg-amber-950"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={pending}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              Delete
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </li>
  )
}

interface OilPairingsProps {
  oilId: string
  pairings: Pairing[]
  otherOils: OtherOil[]
}

export function OilPairings({ oilId, pairings, otherOils }: OilPairingsProps) {
  const router = useRouter()
  const [addRating, setAddRating] = useState<PairingRating>('GOOD')
  const [addReason, setAddReason] = useState('')
  const [addOilId, setAddOilId] = useState('')
  const [addSearch, setAddSearch] = useState('')
  const [pending, startTransition] = useTransition()
  const [addError, setAddError] = useState<string | null>(null)

  const pairedIds = new Set(pairings.map((p) => p.otherId))
  const availableOils = otherOils.filter(
    (o) => !pairedIds.has(o.id) && o.name.toLowerCase().includes(addSearch.toLowerCase()),
  )

  function handleAdd() {
    if (!addOilId || !addReason.trim()) {
      setAddError('Select an oil and enter a reason')
      return
    }
    setAddError(null)
    startTransition(async () => {
      const res = await addPairing(oilId, addOilId, addRating, addReason.trim())
      if (res.ok) {
        setAddOilId('')
        setAddSearch('')
        setAddReason('')
        router.refresh()
      } else {
        setAddError('Failed to add pairing')
      }
    })
  }

  return (
    <div className="mt-10">
      <h2 className="mb-4 font-serif text-xl font-semibold text-stone-900 dark:text-stone-100">
        Pairings <span className="text-sm font-normal text-stone-400">({pairings.length})</span>
      </h2>

      {pairings.length > 0 && (
        <>
          {/* Mobile: card list */}
          <ul className="mb-6 space-y-2 sm:hidden">
            {pairings.map((p) => (
              <PairingCard key={p.id} oilId={oilId} pairing={p} />
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="mb-6 hidden overflow-hidden rounded-lg border border-stone-200 sm:block dark:border-stone-700">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 dark:bg-stone-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-stone-600 dark:text-stone-400">Oil</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-stone-600 dark:text-stone-400">Rating</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-stone-600 dark:text-stone-400">Reason</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pairings.map((p) => (
                  <PairingRow key={p.id} oilId={oilId} pairing={p} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800">
        <h3 className="mb-3 text-sm font-semibold text-stone-800 dark:text-stone-200">Add Pairing</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-xs text-stone-500 dark:text-stone-400">Oil</label>
            <input
              type="text"
              placeholder="Search oils…"
              value={addSearch}
              onChange={(e) => { setAddSearch(e.target.value); setAddOilId('') }}
              className="mb-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
            />
            {addSearch && !addOilId && (
              <div className="rounded border border-stone-200 bg-white shadow-sm dark:border-stone-600 dark:bg-stone-900">
                {availableOils.slice(0, 8).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { setAddOilId(o.id); setAddSearch(o.name) }}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-800 dark:text-stone-200"
                  >
                    {o.name}
                  </button>
                ))}
                {availableOils.length === 0 && (
                  <p className="px-3 py-2 text-xs text-stone-400">No unpaired oils match</p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500 dark:text-stone-400">Rating</label>
            <RatingSelect value={addRating} onChange={setAddRating} />
          </div>
          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-xs text-stone-500 dark:text-stone-400">Reason</label>
            <input
              type="text"
              placeholder="1 sentence explanation…"
              value={addReason}
              onChange={(e) => setAddReason(e.target.value)}
              className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={pending}
            className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {pending ? 'Adding…' : 'Add'}
          </button>
        </div>
        {addError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{addError}</p>}
      </div>
    </div>
  )
}
