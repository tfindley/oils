'use client'

import { useState, useTransition } from 'react'
import { setShareAction } from './actions'

export function OwnerControls({ blendId, initialShared }: { blendId: string; initialShared: boolean }) {
  const [isShared, setIsShared] = useState(initialShared)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    setError(null)
    const next = !isShared
    startTransition(async () => {
      const result = await setShareAction(blendId, next)
      if (result.ok) {
        setIsShared(next)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-700/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-stone-800 dark:text-stone-200">
            {isShared ? '🌐 Public — anyone with the link can view' : '🔒 Private — only visible to you'}
          </p>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            {isShared
              ? 'Turn off to make this blend private. The URL stays the same; only you will be able to view it.'
              : 'Turn on to share this blend with anyone you give the URL to.'}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={isShared}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            isShared ? 'bg-amber-600' : 'bg-stone-300 dark:bg-stone-600'
          } ${pending ? 'opacity-50' : ''}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isShared ? 'translate-x-6' : 'translate-x-1'
          }`} />
          <span className="sr-only">{isShared ? 'Make private' : 'Make public'}</span>
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
