'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const NAV_LINKS = [
  { label: 'Oils', href: '/admin' },
  { label: 'Blends', href: '/admin/blends' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Database', href: '/admin/database' },
  { label: 'Settings', href: '/admin/settings' },
]

export function AdminNav() {
  const pathname = usePathname()
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

  // Close drawer when the route changes
  useEffect(() => setOpen(false), [pathname])

  // Note: the admin layout already gates rendering on server-side auth, so
  // AdminNav only renders when the request is authenticated. No client-side
  // pathname check needed.

  function isActive(href: string) {
    return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  }

  return (
    <nav ref={ref} className="sticky top-0 z-30 border-b border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <span className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">⚙ Admin</span>

        {/* Desktop: inline nav + utilities */}
        <div className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'border-b-2 border-amber-700 text-amber-700 dark:border-amber-500 dark:text-amber-500'
                  : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
          >
            ← Back to Site
          </Link>
          <a
            href="/admin/logout"
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Sign Out
          </a>
        </div>

        {/* Mobile: hamburger */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close admin menu' : 'Open admin menu'}
          aria-expanded={open}
          className="rounded-md p-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 md:hidden"
        >
          {open ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile: drawer */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-900 md:hidden">
          <nav className="mx-auto max-w-6xl divide-y divide-stone-100 px-4 dark:divide-stone-800">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center py-3.5 text-base font-medium transition-colors ${
                  isActive(href)
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-stone-700 hover:text-amber-700 dark:text-stone-300 dark:hover:text-amber-400'
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/"
              className="flex items-center py-3.5 text-base text-stone-600 dark:text-stone-300"
            >
              ← Back to Site
            </Link>
            <a
              href="/admin/logout"
              className="flex items-center py-3.5 text-base font-medium text-red-600 dark:text-red-400"
            >
              Sign Out
            </a>
          </nav>
        </div>
      )}
    </nav>
  )
}
