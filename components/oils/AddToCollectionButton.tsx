'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { addToCollectionAction } from '@/app/my-collection/actions'

interface Props {
  oilId: string
  inCollection: boolean
  signedIn: boolean
}

// Asymmetric by design (v1.4.x):
//   • Not in collection → button adds it on click.
//   • Already in collection → button is a Link to /my-collection (anchored at
//     this oil's row) for editing or removal. Removing from the oil browser
//     was too easy to do by accident.
//   • Signed out → CTA pointing at /login.
export function AddToCollectionButton({ oilId, inCollection: initial, signedIn }: Props) {
  const [inCollection, setInCollection] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!signedIn) {
    return (
      <Link href="/login" className="inline-block">
        <Button variant="secondary">Sign in to track</Button>
      </Link>
    )
  }

  if (inCollection) {
    return (
      <Link href={`/my-collection#oil-${oilId}`} className="inline-block">
        <Button variant="secondary">🛒 In my collection — view</Button>
      </Link>
    )
  }

  function handleClick() {
    if (pending) return
    setError(null)
    setInCollection(true) // optimistic
    startTransition(async () => {
      const r = await addToCollectionAction(oilId)
      if (!r.ok) {
        setInCollection(false)
        setError(r.error)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} disabled={pending}>
        + Add to my collection
      </Button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  )
}
