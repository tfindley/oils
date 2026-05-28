'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { claimBlendAction } from './actions'

export function ClaimButton({ blendId }: { blendId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function claim() {
    setError(null)
    startTransition(async () => {
      const result = await claimBlendAction(blendId)
      if (result.ok) {
        setDone(true)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (done) {
    return (
      <p className="text-sm text-emerald-700 dark:text-emerald-400">
        ✓ Claimed. This blend is now in your library.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-stone-600 dark:text-stone-400">
        This blend has no owner. Claim it to add it to your library.
      </p>
      <Button onClick={claim} disabled={pending} variant="secondary">
        {pending ? 'Claiming…' : 'Claim this blend'}
      </Button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
