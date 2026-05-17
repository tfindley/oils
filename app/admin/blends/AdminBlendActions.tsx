'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { deleteBlend, deleteBlends, deleteAllNonFeatured } from './actions'

interface BlendRow {
  id: string
  name: string
  grade: string
  authorName: string | null
  viewCount: number
  lastAccessedAt: Date | null
  createdAt: Date
  isFeatured: boolean
  isPinned: boolean
  isHidden: boolean
  _count: { ingredients: number }
}

export function AdminBlendActions({ blends }: { blends: BlendRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState('')

  // Strip a pasted full URL down to the bare cuid before matching.
  const normalised = query.trim().split('/').pop()?.toLowerCase() ?? ''
  const visible = normalised
    ? blends.filter(
        (b) =>
          b.id.toLowerCase().includes(normalised) ||
          b.name.toLowerCase().includes(normalised) ||
          (b.authorName ?? '').toLowerCase().includes(normalised),
      )
    : blends

  const visibleIds = visible.map((b) => b.id)
  const allSelected = visible.length > 0 && visibleIds.every((id) => selected.has(id))

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected)
      visibleIds.forEach((id) => next.delete(id))
      setSelected(next)
    } else {
      const next = new Set(selected)
      visibleIds.forEach((id) => next.add(id))
      setSelected(next)
    }
  }

  function toggle(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  function handleDeleteSelected() {
    if (!confirm(`Delete ${selected.size} blend(s)? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteBlends(Array.from(selected))
      setSelected(new Set())
    })
  }

  function handleDeleteAllNonFeatured() {
    const count = blends.filter((b) => !b.isFeatured && !b.isPinned).length
    if (!confirm(`Delete all ${count} non-featured, non-pinned blends? This cannot be undone.`)) return
    startTransition(() => deleteAllNonFeatured())
  }

  function handleDeleteOne(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    startTransition(() => deleteBlend(id))
  }

  function fmt(date: Date | null) {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div>
      {/* Search + bulk action bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by ID, name, or author…"
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base sm:w-72 sm:text-sm focus:border-amber-500 focus:outline-none dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
        />
        <span className="text-xs text-stone-500 dark:text-stone-400">
          {normalised ? `Showing ${visible.length} of ${blends.length}` : `${blends.length} blend${blends.length === 1 ? '' : 's'}`}
        </span>
        {selected.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={pending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete {selected.size} selected
          </button>
        )}
        <button
          onClick={handleDeleteAllNonFeatured}
          disabled={pending}
          className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          Delete all non-featured
        </button>
        {pending && <span className="text-sm text-stone-400">Working…</span>}
      </div>

      {/* Mobile: card list */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400 sm:hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-500">
          {blends.length === 0 ? 'No blends yet.' : 'No blends match your search.'}
        </div>
      ) : (
        <ul className="space-y-2 sm:hidden">
          {visible.map((b) => (
            <li
              key={b.id}
              className={`rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800 ${selected.has(b.id) ? 'ring-2 ring-amber-500' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(b.id)}
                  onChange={() => toggle(b.id)}
                  className="mt-1 h-5 w-5 rounded border-stone-300"
                  aria-label={`Select ${b.name}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-stone-900 dark:text-stone-100">{b.name}</div>
                      <div className="truncate text-xs text-stone-500 dark:text-stone-400">
                        {b.authorName ?? 'No author'}
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      b.grade === 'A' ? 'bg-emerald-100 text-emerald-800' :
                      b.grade === 'B' ? 'bg-amber-100 text-amber-800' :
                      b.grade === 'C' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>{b.grade}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <span>{b.viewCount} view{b.viewCount === 1 ? '' : 's'}</span>
                    <span>Created {fmt(b.createdAt)}</span>
                    <span>Last access {fmt(b.lastAccessedAt)}</span>
                  </div>
                  {(b.isPinned || b.isFeatured || b.isHidden) && (
                    <div className="mt-1 flex gap-2 text-xs">
                      {b.isPinned && <span title="Pinned">📌 Pinned</span>}
                      {b.isFeatured && <span title="Featured">⭐ Featured</span>}
                      {b.isHidden && <span title="Hidden">🙈 Hidden</span>}
                    </div>
                  )}
                  <div className="mt-3 flex justify-end gap-2">
                    <Link
                      href={`/admin/blends/${b.id}`}
                      className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-stone-600 dark:text-amber-500 dark:hover:bg-amber-950"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDeleteOne(b.id, b.name)}
                      disabled={pending}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-xl border border-stone-200 bg-white sm:block dark:border-stone-700 dark:bg-stone-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left dark:border-stone-700 dark:bg-stone-900">
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-stone-300"
                />
              </th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Name</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Author</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Grade</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Views</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Last accessed</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Created</th>
              <th className="px-3 py-3 font-semibold text-stone-700 dark:text-stone-300">Flags</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-stone-400 dark:text-stone-500">
                  {blends.length === 0 ? 'No blends yet.' : 'No blends match your search.'}
                </td>
              </tr>
            )}
            {visible.map((b) => (
              <tr key={b.id} className={`hover:bg-stone-50 dark:hover:bg-stone-700/50 ${selected.has(b.id) ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(b.id)}
                    onChange={() => toggle(b.id)}
                    className="rounded border-stone-300"
                  />
                </td>
                <td className="px-3 py-2.5 font-medium text-stone-900 dark:text-stone-100">{b.name}</td>
                <td className="px-3 py-2.5 text-stone-500 dark:text-stone-400">{b.authorName ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    b.grade === 'A' ? 'bg-emerald-100 text-emerald-800' :
                    b.grade === 'B' ? 'bg-amber-100 text-amber-800' :
                    b.grade === 'C' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>{b.grade}</span>
                </td>
                <td className="px-3 py-2.5 text-stone-500 dark:text-stone-400">{b.viewCount}</td>
                <td className="px-3 py-2.5 text-stone-400 dark:text-stone-500 text-xs">{fmt(b.lastAccessedAt)}</td>
                <td className="px-3 py-2.5 text-stone-400 dark:text-stone-500 text-xs">{fmt(b.createdAt)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    {b.isPinned && <span className="text-xs" title="Pinned">📌</span>}
                    {b.isFeatured && <span className="text-xs" title="Featured">⭐</span>}
                    {b.isHidden && <span className="text-xs" title="Hidden">🙈</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/blends/${b.id}`}
                      className="rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-950"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDeleteOne(b.id, b.name)}
                      disabled={pending}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
