import Link from 'next/link'
import { ThemeToggle } from './ThemeToggle'
import { MobileMenu } from './MobileMenu'
import { UserMenu } from './UserMenu'
import { BlendCart } from '@/components/blend/BlendCart'
import { auth } from '@/auth'

export async function Header() {
  const session = await auth()

  return (
    <header className="relative sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="text-2xl">🌿</span>
          <span className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-100">{process.env.NEXT_PUBLIC_SITE_NAME || 'Oil Blender'}</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/blend" className="rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100">
            Build a Blend
          </Link>
          <Link href="/blends" className="rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100">
            Blends
          </Link>
          <Link href="/oils" className="rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100">
            Oil Library
          </Link>
          <Link href="/oils/compare" className="rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100">
            Compare
          </Link>
          <Link href="/about/glossary" className="rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100">
            Glossary
          </Link>
          <Link href="/about" className="rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100">
            About
          </Link>
        </nav>
        <div className="flex items-center gap-1">
          <BlendCart />
          <ThemeToggle />
          {session?.user ? (
            <UserMenu
              name={session.user.name ?? session.user.email ?? 'You'}
              image={session.user.image ?? null}
              isAdmin={session.user.role === 'ADMIN'}
            />
          ) : (
            <div className="hidden items-center gap-1 md:flex">
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
              >
                Sign up
              </Link>
            </div>
          )}
          <MobileMenu isLoggedIn={!!session?.user} isAdmin={session?.user?.role === 'ADMIN'} />
        </div>
      </div>
    </header>
  )
}
