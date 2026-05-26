'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/blend', label: 'Build a Blend' },
  { href: '/blends', label: 'Blends' },
  { href: '/oils', label: 'Oil Library' },
  { href: '/oils/compare', label: 'Compare' },
  { href: '/about/glossary', label: 'Glossary' },
  { href: '/about', label: 'About' },
]

interface MobileMenuProps {
  isLoggedIn?: boolean
}

export function MobileMenu({ isLoggedIn = false }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
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

  return (
    <div ref={ref} className="md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="rounded-md p-3 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 border-b border-stone-200 bg-white/98 shadow-lg backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/98">
          <nav className="mx-auto max-w-6xl divide-y divide-stone-100 px-4 dark:divide-stone-800">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center py-3.5 text-base font-medium transition-colors ${
                    isActive
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-stone-700 hover:text-amber-700 dark:text-stone-300 dark:hover:text-amber-400'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
            {!isLoggedIn && (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center py-3.5 text-base font-medium text-stone-700 hover:text-amber-700 dark:text-stone-300 dark:hover:text-amber-400"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="flex items-center py-3.5 text-base font-semibold text-amber-700 dark:text-amber-500"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </div>
  )
}
