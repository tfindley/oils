'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export function UserMenu({ name, image }: { name: string; image: string | null }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [open])

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-stone-100 text-sm font-semibold text-stone-700 hover:bg-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initials || '?'}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-stone-200 bg-white shadow-xl dark:border-stone-700 dark:bg-stone-800">
          <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-700">
            <p className="truncate font-medium text-stone-800 dark:text-stone-200">{name}</p>
          </div>
          <nav className="py-1 text-sm">
            <Link
              href="/my-blends"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-700/50"
            >
              My Blends
            </Link>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-700/50"
            >
              Account settings
            </Link>
            <a
              href="/logout"
              className="block px-4 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Sign out
            </a>
          </nav>
        </div>
      )}
    </div>
  )
}
