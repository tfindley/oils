'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/currency'
import {
  removeFromCollectionAction,
  updateCollectionEntryAction,
  type CollectionResult,
} from './actions'

interface Entry {
  id: string
  oilId: string
  quantity: number | null
  bottleSizeMl: number | null
  openedAt: string | null
  expiresAt: string | null
  effectiveExpiry: string | null
  daysUntilExpiry: number | null
  supplier: string | null
  cost: number | null
  batchNo: string | null
  notes: string | null
  addedAt: string
  updatedAt: string
  isCarrier: boolean
  oil: {
    id: string
    name: string
    botanicalName: string
    type: string
    aroma: string
    shelfLifeMonths: number | null
    buyUrl: string | null
  }
}

export function CollectionList({
  entries,
  expiryWarnDays,
  currency,
}: {
  entries: Entry[]
  expiryWarnDays: number
  currency: string
}) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'CARRIER' | 'ESSENTIAL'>('all')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Anchor handling: when navigated to with #oil-<id> (from the oil-detail
  // page's "view in collection" link), open that row's edit form. State lives
  // here, not in each EntryRow, so we avoid reading window.location during
  // render (which would mismatch SSR markup).
  const [expandedOilId, setExpandedOilId] = useState<string | null>(null)
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#oil-')) return
    const oilId = hash.slice('#oil-'.length)
    if (entries.some((e) => e.oilId === oilId)) {
      setExpandedOilId(oilId)
    } else {
      // Oil isn't in collection — strip the hash so a refresh doesn't retry.
      history.replaceState(null, '', window.location.pathname)
    }
  }, [entries])

  const q = query.trim().toLowerCase()
  const visible = entries.filter((e) => {
    if (typeFilter !== 'all' && e.oil.type !== typeFilter) return false
    if (!q) return true
    return (
      e.oil.name.toLowerCase().includes(q) ||
      e.oil.botanicalName.toLowerCase().includes(q) ||
      (e.supplier ?? '').toLowerCase().includes(q) ||
      (e.batchNo ?? '').toLowerCase().includes(q) ||
      (e.notes ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, supplier, batch, notes…"
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base sm:w-72 sm:text-sm focus:border-amber-500 focus:outline-none dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
        />
        <div className="flex rounded-md border border-stone-200 text-xs dark:border-stone-600">
          {(['all', 'CARRIER', 'ESSENTIAL'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 transition-colors first:rounded-l-md last:rounded-r-md ${
                typeFilter === t
                  ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900'
                  : 'text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-700'
              }`}
            >
              {t === 'all' ? 'All' : t === 'CARRIER' ? 'Carriers' : 'Essentials'}
            </button>
          ))}
        </div>
        <span className="text-xs text-stone-500 dark:text-stone-400">
          {q || typeFilter !== 'all' ? `Showing ${visible.length} of ${entries.length}` : `${entries.length} oil${entries.length === 1 ? '' : 's'}`}
        </span>
        {message && (
          <span className={`ml-auto text-sm ${message.kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {message.text}
          </span>
        )}
      </div>

      {visible.length === 0 && (
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-12 text-center text-sm text-stone-400 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-500">
          No oils match your filter.
        </p>
      )}

      <ul className="space-y-3">
        {visible.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            expiryWarnDays={expiryWarnDays}
            currency={currency}
            initialExpanded={entry.oilId === expandedOilId}
            onMessage={setMessage}
          />
        ))}
      </ul>
    </div>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  // toISOString().slice(0, 10) for the <input type=date> value
  return iso.slice(0, 10)
}

function EntryRow({
  entry,
  expiryWarnDays,
  currency,
  initialExpanded,
  onMessage,
}: {
  entry: Entry
  expiryWarnDays: number
  currency: string
  initialExpanded: boolean
  onMessage: (m: { kind: 'ok' | 'err'; text: string } | null) => void
}) {
  // Parent (CollectionList) drives expansion from the URL hash via useEffect
  // — keeps `window` reads out of render so SSR markup matches client.
  const [expanded, setExpanded] = useState(initialExpanded)
  useEffect(() => {
    if (initialExpanded) setExpanded(true)
  }, [initialExpanded])
  const [pending, startTransition] = useTransition()

  const warnExpiry =
    entry.daysUntilExpiry != null && entry.daysUntilExpiry <= expiryWarnDays
  const expired = entry.daysUntilExpiry != null && entry.daysUntilExpiry < 0

  function handleRemove() {
    if (!confirm(`Remove ${entry.oil.name} from your collection?`)) return
    startTransition(async () => {
      const r = await removeFromCollectionAction(entry.oilId)
      onMessage(r.ok ? { kind: 'ok', text: r.message ?? 'Removed.' } : { kind: 'err', text: r.error })
    })
  }

  function handleSubmit(formData: FormData): void {
    startTransition(async () => {
      const r: CollectionResult = await updateCollectionEntryAction(null, formData)
      onMessage(r.ok ? { kind: 'ok', text: r.message ?? 'Saved.' } : { kind: 'err', text: r.error })
    })
  }

  // Build the cost display: "£12.50 for 30 ml" when both present, "£12.50"
  // when only cost is set, "30 ml bottle" when only the size is, nothing otherwise.
  const costDisplay = (() => {
    const c = entry.cost != null && entry.cost > 0 ? formatCurrency(entry.cost, currency) : null
    const s = entry.bottleSizeMl != null && entry.bottleSizeMl > 0 ? `${entry.bottleSizeMl} ml` : null
    if (c && s) return `${c} for ${s}`
    if (c) return c
    if (s) return `${s} bottle`
    return null
  })()

  return (
    <li
      id={`oil-${entry.oilId}`}
      className={`scroll-mt-20 rounded-xl border bg-white p-4 dark:bg-stone-800 ${
        expired
          ? 'border-red-300 dark:border-red-700'
          : warnExpiry
          ? 'border-amber-300 dark:border-amber-700'
          : 'border-stone-200 dark:border-stone-700'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/oils/${entry.oil.id}`}
              className="font-serif text-lg font-semibold text-stone-900 hover:text-amber-700 dark:text-stone-100 dark:hover:text-amber-400"
            >
              {entry.oil.name}
            </Link>
            <Badge variant={entry.isCarrier ? 'default' : 'GOOD'}>
              {entry.isCarrier ? 'Carrier' : 'Essential'}
            </Badge>
            {expired ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                ⚠ Expired
              </span>
            ) : warnExpiry ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                ⏳ {entry.daysUntilExpiry}d to expiry
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs italic text-stone-400 dark:text-stone-500">{entry.oil.botanicalName}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
            {entry.quantity != null && <span>{entry.quantity} ml remaining</span>}
            {entry.supplier && <span>via {entry.supplier}</span>}
            {costDisplay && <span>{costDisplay}</span>}
            {entry.openedAt && <span>opened {fmtDate(entry.openedAt)}</span>}
            {entry.effectiveExpiry && !warnExpiry && !expired && <span>expires {fmtDate(entry.effectiveExpiry)}</span>}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            {expanded ? 'Close' : 'Edit'}
          </button>
          <button
            onClick={handleRemove}
            disabled={pending}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Remove
          </button>
        </div>
      </div>

      {expanded && (
        <form
          action={handleSubmit}
          className="mt-4 grid grid-cols-1 gap-3 border-t border-stone-100 pt-4 sm:grid-cols-2 dark:border-stone-700"
        >
          <input type="hidden" name="oilId" value={entry.oilId} />

          <Field label="Quantity remaining (ml)" name="quantity" type="number" step="0.1" min="0" defaultValue={entry.quantity ?? ''} />
          <Field label="Bottle size (ml)" name="bottleSizeMl" type="number" step="0.1" min="0" defaultValue={entry.bottleSizeMl ?? ''} placeholder="e.g. 30" hint="size of the bottle the cost paid is for" />
          <Field label={`Price paid (${currency})`} name="cost" type="number" step="0.01" min="0" defaultValue={entry.cost ?? ''} hint={`shown to you in ${currency} — change your currency in /account`} />
          <Field label="Opened on" name="openedAt" type="date" defaultValue={fmtDate(entry.openedAt)} />
          <Field label="Expires on" name="expiresAt" type="date" defaultValue={fmtDate(entry.expiresAt)} hint={entry.oil.shelfLifeMonths ? `defaults to opened-at + ${entry.oil.shelfLifeMonths} months when blank` : undefined} />
          <Field label="Supplier" name="supplier" type="text" defaultValue={entry.supplier ?? ''} placeholder="e.g. NHR Organic Oils" />
          <Field label="Batch number" name="batchNo" type="text" defaultValue={entry.batchNo ?? ''} placeholder="e.g. L240618" />

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">Notes</label>
            <textarea
              name="notes"
              defaultValue={entry.notes ?? ''}
              rows={2}
              maxLength={2000}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base sm:text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-700 dark:text-stone-100"
            />
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </li>
  )
}

function Field({
  label,
  name,
  type,
  defaultValue,
  placeholder,
  hint,
  step,
  min,
}: {
  label: string
  name: string
  type: 'text' | 'number' | 'date'
  defaultValue: string | number
  placeholder?: string
  hint?: string
  step?: string
  min?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
        {label}
      </label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        step={step}
        min={min}
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base sm:text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-700 dark:text-stone-100"
      />
      {hint && <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">{hint}</p>}
    </div>
  )
}
