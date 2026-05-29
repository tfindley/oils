'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { OilSummary, PairingRating, BlendGrade } from '@/types'
import { calculateBlend, dropsToPct, pctToDrops } from '@/lib/blend-calculator'
import { scoreBlend } from '@/lib/blend-scorer'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { CompatibilityPanel } from './CompatibilityPanel'
import { QuantityTable } from './QuantityTable'
import { OilPicker } from './OilPicker'
import { NumberStepper } from './NumberStepper'
import { SelectedOilsCard } from './SelectedOilsCard'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { loadDraft, saveDraft, clearDraft, DRAFT_CHANGE_EVENT } from '@/lib/blend-storage'
import { isScorable, isSavable } from '@/lib/blend-rules'

const VOLUME_PRESETS = [10, 30, 50, 100, 200]
const DILUTION_PRESETS = [
  { label: '1%', sublabel: 'sensitive', value: 0.01 },
  { label: '2%', sublabel: 'daily', value: 0.02 },
  { label: '3%', sublabel: 'therapeutic', value: 0.03 },
  { label: '5%', sublabel: 'targeted', value: 0.05 },
]
const MAX_CARRIERS = 5
const MAX_EOS = 5
const MIN_DILUTION_RATE = 0.001  // 0.1% — floor for displayed/saved dilution

function dilutionFromEOs(eos: { percentagePct: number }[]): number {
  return Math.max(MIN_DILUTION_RATE, eos.reduce((s, e) => s + e.percentagePct, 0) / 100)
}

interface SelectedEO {
  oil: OilSummary
  percentagePct: number
}

interface SelectedCarrier {
  oil: OilSummary
  volumeMl: number
}

interface Pairing {
  oilAId: string
  oilAName: string
  oilBId: string
  oilBName: string
  rating: PairingRating
  reason: string
}

type Tab = 1 | 2 | 3 | 4

interface TabSpec {
  id: Tab
  shortLabel: string
  fullLabel: string
  badge?: number
}

interface BlendBuilderProps {
  carriers: OilSummary[]
  essentials: OilSummary[]
  initialBlend?: {
    carriers: Array<{ oil: OilSummary; volumeMl: number }>
    essentials: Array<{ oil: OilSummary; percentagePct: number }>
    totalVolumeMl: number
    dilutionRate: number
  }
  pendingOilId?: string
  tooltipsEnabled?: boolean
  // v1.4: signed-in user's oil collection IDs, fetched server-side. Powers
  // the "From my collection" filter chip in each picker. Empty / undefined
  // when the viewer is signed out, which hides the chip entirely.
  collectionOilIds?: string[]
}

export function BlendBuilder({ carriers, essentials, initialBlend, pendingOilId, tooltipsEnabled = true, collectionOilIds = [] }: BlendBuilderProps) {
  const router = useRouter()

  const [selectedCarriers, setSelectedCarriers] = useState<SelectedCarrier[]>(initialBlend?.carriers ?? [])
  const [selectedEOs, setSelectedEOs] = useState<SelectedEO[]>(initialBlend?.essentials ?? [])
  const [totalVolumeMl, setTotalVolumeMl] = useState(initialBlend?.totalVolumeMl ?? 50)
  const [customVolume, setCustomVolume] = useState('')
  const [dilutionRate, setDilutionRate] = useState(initialBlend?.dilutionRate ?? 0.02)
  const [pairings, setPairings] = useState<Pairing[]>([])
  const [blendName, setBlendName] = useState('')
  const [blendNotes, setBlendNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [eoSearch, setEoSearch] = useState('')
  const [eoMode, setEoMode] = useState<'search' | 'browse'>('search')
  const [eoCollectionOnly, setEoCollectionOnly] = useState(false)
  const [carrierSearch, setCarrierSearch] = useState('')
  const [carrierMode, setCarrierMode] = useState<'search' | 'browse'>('search')
  const [carrierCollectionOnly, setCarrierCollectionOnly] = useState(false)

  // v1.4: oil IDs the user has in their collection, split per type so each
  // picker only shows the "from my collection" chip when the user has at
  // least one oil of that type. Memoised so we don't re-walk the oil arrays
  // on every keystroke in the builder.
  const { carrierCollectionIds, eoCollectionIds } = useMemo(() => {
    const carrierIds = new Set(carriers.map((o) => o.id))
    const eoIds = new Set(essentials.map((o) => o.id))
    const carrier = new Set<string>()
    const eo = new Set<string>()
    for (const id of collectionOilIds) {
      if (carrierIds.has(id)) carrier.add(id)
      else if (eoIds.has(id)) eo.add(id)
    }
    return { carrierCollectionIds: carrier, eoCollectionIds: eo }
  }, [carriers, essentials, collectionOilIds])
  const [activeTab, setActiveTab] = useState<Tab>(initialBlend?.carriers && initialBlend.carriers.length > 0 ? 3 : 1)
  const [avoidAcknowledged, setAvoidAcknowledged] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const fetchPairings = useCallback(async (ids: string[]) => {
    if (ids.length < 2) { setPairings([]); return }
    try {
      const res = await fetch(`/api/pairings?oilIds=${ids.join(',')}`)
      if (res.ok) setPairings(await res.json())
    } catch { /* silently skip */ }
  }, [])

  useEffect(() => {
    fetchPairings([...selectedCarriers.map((c) => c.oil.id), ...selectedEOs.map((e) => e.oil.id)])
  }, [selectedCarriers.map((c) => c.oil.id).join(','), selectedEOs.map((e) => e.oil.id).join(',')]) // eslint-disable-line

  // Hydrate from localStorage draft on mount, and apply any pending oil from the URL.
  useEffect(() => {
    // ?from=<id> takes over the builder; clear any draft so it doesn't merge in.
    if (initialBlend) {
      clearDraft()
      setHydrated(true)
      return
    }

    const draft = loadDraft()
    let nextCarriers = draft
      ? draft.carriers
          .map((c) => {
            const oil = carriers.find((o) => o.id === c.oilId)
            return oil ? { oil, volumeMl: c.volumeMl } : null
          })
          .filter((c): c is { oil: OilSummary; volumeMl: number } => c != null)
      : []
    let nextEOs = draft
      ? draft.essentials
          .map((e) => {
            const oil = essentials.find((o) => o.id === e.oilId)
            return oil ? { oil, percentagePct: e.percentagePct } : null
          })
          .filter((e): e is { oil: OilSummary; percentagePct: number } => e != null)
      : []
    const nextVolume = draft?.totalVolumeMl ?? 50
    const nextDilution = draft?.dilutionRate ?? 0.02

    // Apply pending oil from URL (?oil=<id>)
    let appliedPending = false
    if (pendingOilId) {
      const carrier = carriers.find((o) => o.id === pendingOilId)
      const eo = essentials.find((o) => o.id === pendingOilId)
      if (carrier && !nextCarriers.some((c) => c.oil.id === carrier.id) && nextCarriers.length < MAX_CARRIERS) {
        const merged = [...nextCarriers, { oil: carrier, volumeMl: 0 }]
        const even = nextVolume / merged.length
        nextCarriers = merged.map((c) => ({ ...c, volumeMl: even }))
        appliedPending = true
      } else if (eo && !nextEOs.some((e) => e.oil.id === eo.id) && nextEOs.length < MAX_EOS) {
        nextEOs = [...nextEOs, { oil: eo, percentagePct: dropsToPct(1, nextVolume) }]
        appliedPending = true
      }
    }

    if (draft || appliedPending) {
      setSelectedCarriers(nextCarriers)
      setSelectedEOs(nextEOs)
      setTotalVolumeMl(nextVolume)
      setDilutionRate(appliedPending && nextEOs.length > 0
        ? Math.max(MIN_DILUTION_RATE, nextEOs.reduce((s, e) => s + e.percentagePct, 0) / 100)
        : nextDilution)
      if (draft?.blendName) setBlendName(draft.blendName)
      if (draft?.blendNotes) setBlendNotes(draft.blendNotes)
      if (nextCarriers.length > 0 || nextEOs.length > 0) setActiveTab(3)
    }

    // Strip ?oil= from the URL so refresh doesn't re-add the same oil
    if (pendingOilId) {
      router.replace('/blend')
    }

    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external draft changes (e.g. the BlendCart removing an oil) into builder state.
  // We only re-sync when the oil-set membership actually differs — our own auto-saves
  // produce identical sets, so this is a no-op for them.
  useEffect(() => {
    if (!hydrated) return
    const handler = () => {
      const draft = loadDraft()
      const builderKey = [
        ...selectedCarriers.map((c) => c.oil.id),
        ...selectedEOs.map((e) => e.oil.id),
      ].sort().join(',')
      const draftKey = draft
        ? [
            ...draft.carriers.map((c) => c.oilId),
            ...draft.essentials.map((e) => e.oilId),
          ].sort().join(',')
        : ''
      if (builderKey === draftKey) return
      if (!draft) {
        setSelectedCarriers([])
        setSelectedEOs([])
        return
      }
      setSelectedCarriers(
        draft.carriers
          .map((c) => {
            const oil = carriers.find((o) => o.id === c.oilId)
            return oil ? { oil, volumeMl: c.volumeMl } : null
          })
          .filter((c): c is { oil: OilSummary; volumeMl: number } => c != null)
      )
      setSelectedEOs(
        draft.essentials
          .map((e) => {
            const oil = essentials.find((o) => o.id === e.oilId)
            return oil ? { oil, percentagePct: e.percentagePct } : null
          })
          .filter((e): e is { oil: OilSummary; percentagePct: number } => e != null)
      )
    }
    window.addEventListener(DRAFT_CHANGE_EVENT, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(DRAFT_CHANGE_EVENT, handler)
      window.removeEventListener('storage', handler)
    }
  }, [hydrated, selectedCarriers, selectedEOs, carriers, essentials])

  const score = scoreBlend(pairings)
  const hasBlend = isScorable(selectedCarriers.length, selectedEOs.length)
  const savable = isSavable(selectedCarriers.length, selectedEOs.length)

  // Auto-save the draft whenever blend state changes (after hydration).
  // Empty-check is oil-only: a name or note without any oils is not a blend,
  // so we drop it rather than persist a "ghost" draft across sessions.
  useEffect(() => {
    if (!hydrated) return
    if (selectedCarriers.length === 0 && selectedEOs.length === 0) {
      clearDraft()
      return
    }
    saveDraft({
      v: 2,
      carriers: selectedCarriers.map((c) => ({ oilId: c.oil.id, name: c.oil.name, volumeMl: c.volumeMl })),
      essentials: selectedEOs.map((e) => ({ oilId: e.oil.id, name: e.oil.name, percentagePct: e.percentagePct })),
      totalVolumeMl,
      dilutionRate,
      blendName: blendName || undefined,
      blendNotes: blendNotes || undefined,
      grade: hasBlend ? score.grade : undefined,
    })
  }, [hydrated, selectedCarriers, selectedEOs, totalVolumeMl, dilutionRate, blendName, blendNotes, hasBlend, score.grade])

  function handleReset() {
    setSelectedCarriers([])
    setSelectedEOs([])
    setTotalVolumeMl(50)
    setCustomVolume('')
    setDilutionRate(0.02)
    setPairings([])
    setBlendName('')
    setBlendNotes('')
    setSaveError('')
    setAvoidAcknowledged(false)
    setEoSearch('')
    setEoMode('search')
    setCarrierSearch('')
    setCarrierMode('search')
    setActiveTab(1)
    clearDraft()
  }

  const ingredientInputs = [
    ...selectedCarriers.map((c) => ({
      oilId: c.oil.id,
      name: c.oil.name,
      type: 'CARRIER' as const,
      percentagePct: 0,
      volumeMl: c.volumeMl,
    })),
    ...selectedEOs.map((e) => ({
      oilId: e.oil.id,
      name: e.oil.name,
      type: 'ESSENTIAL' as const,
      percentagePct: e.percentagePct,
      dilutionRateMax: e.oil.dilutionRateMax,
    })),
  ]

  const calc = selectedCarriers.length > 0
    ? calculateBlend(totalVolumeMl, dilutionRate, ingredientInputs)
    : { totalVolumeMl, finalVolumeMl: totalVolumeMl, dilutionRate, essentialOilTotalMl: 0, carrierVolumeMl: 0, ingredients: [], warnings: [] }

  const unsafePairings = pairings.filter((p) => p.rating === 'UNSAFE')
  const avoidPairings = pairings.filter((p) => p.rating === 'AVOID')

  const carrierSum = selectedCarriers.reduce((s, c) => s + c.volumeMl, 0)
  const carrierDrift = carrierSum - totalVolumeMl

  const calcByOilId = new Map(calc.ingredients.map((i) => [i.oilId, i]))

  function addCarrier(oil: OilSummary) {
    if (selectedCarriers.some((c) => c.oil.id === oil.id)) return
    if (selectedCarriers.length >= MAX_CARRIERS) return
    setCarrierSearch('')
    setAvoidAcknowledged(false)
    const next = [...selectedCarriers, { oil, volumeMl: 0 }]
    const even = totalVolumeMl / next.length
    setSelectedCarriers(next.map((c) => ({ ...c, volumeMl: even })))
  }

  function removeCarrier(id: string) {
    setAvoidAcknowledged(false)
    setSelectedCarriers(selectedCarriers.filter((c) => c.oil.id !== id))
  }

  function updateCarrierMl(id: string, ml: number) {
    setSelectedCarriers(selectedCarriers.map((c) =>
      c.oil.id === id ? { ...c, volumeMl: Math.max(0, ml) } : c
    ))
  }

  function fitCarriersToVolume() {
    if (selectedCarriers.length === 0) return
    if (carrierSum <= 0) {
      const even = totalVolumeMl / selectedCarriers.length
      setSelectedCarriers(selectedCarriers.map((c) => ({ ...c, volumeMl: even })))
    } else {
      const scale = totalVolumeMl / carrierSum
      setSelectedCarriers(selectedCarriers.map((c) => ({ ...c, volumeMl: c.volumeMl * scale })))
    }
  }

  function changeVolume(newVolume: number) {
    if (selectedCarriers.length > 0 && carrierSum > 0) {
      const scale = newVolume / carrierSum
      setSelectedCarriers(selectedCarriers.map((c) => ({ ...c, volumeMl: c.volumeMl * scale })))
    }
    setTotalVolumeMl(newVolume)
  }

  function addEO(oil: OilSummary) {
    if (selectedEOs.some((e) => e.oil.id === oil.id)) return
    if (selectedEOs.length >= MAX_EOS) return
    setEoSearch('')
    setAvoidAcknowledged(false)
    const newEOs = [...selectedEOs, { oil, percentagePct: dropsToPct(1, totalVolumeMl) }]
    setSelectedEOs(newEOs)
    setDilutionRate(dilutionFromEOs(newEOs))
  }

  function removeEO(id: string) {
    setAvoidAcknowledged(false)
    const next = selectedEOs.filter((e) => e.oil.id !== id)
    setSelectedEOs(next)
    setDilutionRate(dilutionFromEOs(next))
  }

  function updateDrops(id: string, drops: number) {
    const pct = dropsToPct(Math.max(1, drops), totalVolumeMl)
    const newEOs = selectedEOs.map((e) => (e.oil.id === id ? { ...e, percentagePct: pct } : e))
    setSelectedEOs(newEOs)
    setDilutionRate(dilutionFromEOs(newEOs))
  }

  function changeDilution(newRate: number) {
    if (selectedEOs.length === 0) {
      setDilutionRate(newRate)
      return
    }
    const oldSum = selectedEOs.reduce((s, e) => s + e.percentagePct, 0)
    const targetSum = newRate * 100
    let newEOs: SelectedEO[]
    if (oldSum > 0) {
      const scale = targetSum / oldSum
      newEOs = selectedEOs.map((e) => ({ ...e, percentagePct: e.percentagePct * scale }))
    } else {
      const each = targetSum / selectedEOs.length
      newEOs = selectedEOs.map((e) => ({ ...e, percentagePct: each }))
    }
    setSelectedEOs(newEOs)
    setDilutionRate(newRate)
  }

  const selectedIds = new Set([
    ...selectedCarriers.map((c) => c.oil.id),
    ...selectedEOs.map((e) => e.oil.id),
  ])
  const unsafePartner = new Map<string, Pairing>()
  for (const p of pairings) {
    if (p.rating !== 'UNSAFE') continue
    if (selectedIds.has(p.oilAId) && !unsafePartner.has(p.oilBId)) unsafePartner.set(p.oilBId, p)
    if (selectedIds.has(p.oilBId) && !unsafePartner.has(p.oilAId)) unsafePartner.set(p.oilAId, p)
  }

  function findUnsafePairing(oil: OilSummary): Pairing | undefined {
    return unsafePartner.get(oil.id)
  }

  const selectedCarrierOils = selectedCarriers.map((c) => c.oil)
  const selectedEOOils = selectedEOs.map((e) => e.oil)

  function toggleCarrier(oil: OilSummary) {
    if (selectedCarriers.some((c) => c.oil.id === oil.id)) removeCarrier(oil.id)
    else addCarrier(oil)
  }

  function toggleEO(oil: OilSummary) {
    if (selectedEOs.some((e) => e.oil.id === oil.id)) removeEO(oil.id)
    else addEO(oil)
  }

  const canSave =
    savable &&
    blendName.trim().length > 0 &&
    unsafePairings.length === 0 &&
    (avoidPairings.length === 0 || avoidAcknowledged)

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setSaveError('')
    const payload = {
      name: blendName.trim(),
      notes: blendNotes.trim() || undefined,
      totalVolumeMl,
      dilutionRate,
      grade: score.grade,
      ingredients: calc.ingredients.map((i) => ({
        oilId: i.oilId,
        percentagePct: i.percentagePct,
        volumeMl: i.volumeMl,
      })),
    }
    try {
      const res = await fetch('/api/blends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        setSaveError(err.error ?? 'Failed to save blend.')
        return
      }
      const { id } = await res.json()
      // Reset form state so a fresh /blend visit doesn't repopulate name/notes
      // from React state via the auto-save effect before navigation completes.
      setBlendName('')
      setBlendNotes('')
      clearDraft()
      router.push(`/blend/${id}`)
    } catch {
      setSaveError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const tabs: TabSpec[] = [
    { id: 1, shortLabel: 'Carriers', fullLabel: '1. Carrier Oils', badge: selectedCarriers.length || undefined },
    { id: 2, shortLabel: 'Essentials', fullLabel: '2. Essential Oils', badge: selectedEOs.length || undefined },
    { id: 3, shortLabel: 'Quantities', fullLabel: '3. Quantities' },
    { id: 4, shortLabel: 'Save', fullLabel: '4. Save Blend' },
  ]
  const activeTabSpec = tabs.find((t) => t.id === activeTab)!

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

      {/* ── Left column / full-width on mobile: tabs ── */}
      <div className="lg:col-span-2">
        <HelpTooltip
          id="blend-builder"
          siteEnabled={tooltipsEnabled}
          interacted={selectedCarriers.length > 0 || selectedEOs.length > 0 || activeTab !== 1}
        >
          <p className="font-semibold text-amber-900 dark:text-amber-200">New here?</p>
          <p className="mt-0.5 text-amber-800 dark:text-amber-300">
            Pick a carrier oil on Tab 1, an essential oil on Tab 2, then jump to Quantities. Tap any oil to see its profile.
          </p>
        </HelpTooltip>
        {/* Tab strip */}
        <div className="flex items-stretch border-b border-stone-200 dark:border-stone-700">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex-1 whitespace-nowrap px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors -mb-px border-b-2 ${
                activeTab === t.id
                  ? 'border-amber-500 text-amber-700 dark:text-amber-500'
                  : 'border-transparent text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
              }`}
            >
              <span className="hidden sm:inline">{t.fullLabel}</span>
              <span className="sm:hidden">{t.shortLabel}</span>
              {t.badge != null && t.badge > 0 && (
                <span className="ml-1.5 inline-block rounded-full bg-amber-700 px-1.5 py-0.5 text-[10px] leading-none text-white">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-4">
          {/* Tab 1 — Carriers */}
          {activeTab === 1 && (
            <div className="space-y-3">
              <div>
                <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">{activeTabSpec.fullLabel}</h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {selectedCarriers.length === 0
                    ? `Select up to ${MAX_CARRIERS} carriers.`
                    : `${selectedCarriers.length} of ${MAX_CARRIERS} selected`}
                </p>
              </div>
              <OilPicker
                noun="carriers"
                oils={carriers}
                selectedOils={selectedCarrierOils}
                maxCount={MAX_CARRIERS}
                findUnsafe={findUnsafePairing}
                onToggle={toggleCarrier}
                mode={carrierMode}
                onModeChange={setCarrierMode}
                searchValue={carrierSearch}
                onSearchChange={setCarrierSearch}
                collectionOilIds={carrierCollectionIds}
                collectionOnly={carrierCollectionOnly}
                onCollectionOnlyChange={setCarrierCollectionOnly}
                footer={
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setActiveTab(2)}
                      disabled={selectedCarriers.length === 0}
                      className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next →
                    </button>
                  </div>
                }
              />
            </div>
          )}

          {/* Tab 2 — Essentials */}
          {activeTab === 2 && (
            <div className="space-y-3">
              <div>
                <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">{activeTabSpec.fullLabel}</h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {selectedEOs.length === 0
                    ? `Select up to ${MAX_EOS} essential oils.`
                    : `${selectedEOs.length} of ${MAX_EOS} selected`}
                </p>
              </div>
              <OilPicker
                noun="essential oils"
                oils={essentials}
                selectedOils={selectedEOOils}
                maxCount={MAX_EOS}
                findUnsafe={findUnsafePairing}
                onToggle={toggleEO}
                mode={eoMode}
                onModeChange={setEoMode}
                searchValue={eoSearch}
                onSearchChange={setEoSearch}
                collectionOilIds={eoCollectionIds}
                collectionOnly={eoCollectionOnly}
                onCollectionOnlyChange={setEoCollectionOnly}
                footer={
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setActiveTab(3)}
                      disabled={selectedEOs.length === 0}
                      className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next →
                    </button>
                  </div>
                }
              />
            </div>
          )}

          {/* Tab 3 — Quantities */}
          {activeTab === 3 && (
            <div className="space-y-5">
              <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">{activeTabSpec.fullLabel}</h2>

              {/* Volume */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">Volume</p>
                <div className="flex flex-wrap gap-1.5">
                  {VOLUME_PRESETS.map((v) => (
                    <button
                      key={v}
                      onClick={() => { changeVolume(v); setCustomVolume('') }}
                      className={`rounded border px-3 py-2 text-sm transition-all ${
                        totalVolumeMl === v && !customVolume
                          ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                          : 'border-stone-200 text-stone-500 hover:border-amber-300 dark:border-stone-600 dark:text-stone-400 dark:hover:border-amber-500'
                      }`}
                    >
                      {v} ml
                    </button>
                  ))}
                  <input
                    type="number"
                    placeholder="Custom"
                    value={customVolume}
                    min={5}
                    max={500}
                    onChange={(e) => {
                      setCustomVolume(e.target.value)
                      const v = parseInt(e.target.value)
                      if (v >= 5) changeVolume(v)
                    }}
                    className="w-20 rounded border border-stone-200 bg-white px-2 py-2 text-base sm:text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-700 dark:text-stone-100"
                  />
                </div>
              </div>

              {/* Dilution */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">Dilution</p>
                <div className="flex flex-wrap gap-1.5">
                  {DILUTION_PRESETS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => changeDilution(d.value)}
                      className={`rounded border px-3 py-2 text-left text-xs transition-all ${
                        dilutionRate === d.value
                          ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                          : 'border-stone-200 text-stone-500 hover:border-amber-300 dark:border-stone-600 dark:text-stone-400 dark:hover:border-amber-500'
                      }`}
                    >
                      <span className="font-medium">{d.label}</span>
                      <span className="ml-1 text-stone-400 dark:text-stone-500">{d.sublabel}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">
                  Final mix: {calc.finalVolumeMl.toFixed(1)} ml
                  ({calc.carrierVolumeMl.toFixed(1)} ml carrier + {calc.essentialOilTotalMl.toFixed(1)} ml essentials)
                </p>
              </div>

              {/* Per-oil dilution warnings */}
              {calc.warnings.length > 0 && (
                <div className="space-y-2">
                  {calc.warnings.map((w, i) => (
                    <Alert key={i} variant="caution">{w}</Alert>
                  ))}
                </div>
              )}

              {/* Carriers table */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  Carrier Oils {selectedCarriers.length > 0 && `(${selectedCarriers.length}/${MAX_CARRIERS})`}
                </p>
                {selectedCarriers.length === 0 ? (
                  <p className="text-sm italic text-stone-400 dark:text-stone-500">
                    None selected — go to{' '}
                    <button onClick={() => setActiveTab(1)} className="text-amber-700 underline hover:no-underline dark:text-amber-500">
                      Carriers
                    </button>{' '}to add some.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-stone-200 dark:border-stone-700">
                    <table className="w-full text-sm">
                      <thead className="bg-stone-50 dark:bg-stone-800">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-stone-600 dark:text-stone-300">Oil</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-stone-600 dark:text-stone-300">ml</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-stone-600 dark:text-stone-300">ratio</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
                        {selectedCarriers.map((c) => {
                          const ratio = carrierSum > 0
                            ? Math.round((c.volumeMl / carrierSum) * 100)
                            : null
                          return (
                            <tr key={c.oil.id}>
                              <td className="px-3 py-2 text-stone-800 dark:text-stone-100">
                                <div className="font-medium">{c.oil.name}</div>
                                <div className="text-[10px] italic text-stone-400 dark:text-stone-500">{c.oil.botanicalName}</div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <NumberStepper
                                  value={Math.round(c.volumeMl)}
                                  min={0}
                                  max={500}
                                  onChange={(v) => updateCarrierMl(c.oil.id, v)}
                                  ariaLabel={`${c.oil.name} ml`}
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-stone-600 dark:text-stone-300">
                                {ratio == null ? '—' : `${ratio}%`}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => removeCarrier(c.oil.id)}
                                  className="rounded-full p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 dark:text-stone-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                                  aria-label={`Remove ${c.oil.name}`}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="border-t border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800">
                        <tr>
                          <td className="px-3 py-2 font-medium text-stone-700 dark:text-stone-200">Total</td>
                          <td className={`px-3 py-2 text-right font-mono font-medium ${
                            Math.abs(carrierDrift) >= 0.5
                              ? carrierDrift > 0 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-500'
                              : 'text-stone-700 dark:text-stone-200'
                          }`}>
                            {carrierSum.toFixed(0)} ml
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-stone-700 dark:text-stone-200">
                            {carrierSum > 0 ? '100%' : '—'}
                          </td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                {selectedCarriers.length > 0 && Math.abs(carrierDrift) >= 0.5 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-500">
                    <span>
                      {carrierDrift > 0
                        ? `${carrierDrift.toFixed(0)} ml over Volume`
                        : `${(-carrierDrift).toFixed(0)} ml unallocated`}
                    </span>
                    <button onClick={fitCarriersToVolume} className="underline hover:no-underline">
                      Fit to Volume
                    </button>
                  </div>
                )}
              </div>

              {/* EOs table */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  Essential Oils {selectedEOs.length > 0 && `(${selectedEOs.length}/${MAX_EOS})`}
                </p>
                {selectedEOs.length === 0 ? (
                  <p className="text-sm italic text-stone-400 dark:text-stone-500">
                    None selected — go to{' '}
                    <button onClick={() => setActiveTab(2)} className="text-amber-700 underline hover:no-underline dark:text-amber-500">
                      Essentials
                    </button>{' '}to add some.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-stone-200 dark:border-stone-700">
                    <table className="w-full text-sm">
                      <thead className="bg-stone-50 dark:bg-stone-800">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-stone-600 dark:text-stone-300">Oil</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-stone-600 dark:text-stone-300">drops</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-stone-600 dark:text-stone-300">ml</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-stone-600 dark:text-stone-300">%</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
                        {selectedEOs.map((e) => {
                          const calcEntry = calcByOilId.get(e.oil.id)
                          const drops = pctToDrops(e.percentagePct, totalVolumeMl)
                          const volMl = calcEntry?.volumeMl ?? 0
                          const over = calcEntry?.overMaxDilution ?? false
                          const pct = totalVolumeMl > 0 ? (volMl / totalVolumeMl) * 100 : 0
                          const pctDisplay = pct < 1 ? '<1%' : `${pct.toFixed(1)}%`
                          const rowClass = over
                            ? 'bg-red-50/50 dark:bg-red-950/20'
                            : ''
                          const numClass = over ? 'text-red-700 dark:text-red-400' : 'text-stone-600 dark:text-stone-300'
                          return (
                            <tr key={e.oil.id} className={rowClass}>
                              <td className={`px-3 py-2 ${over ? 'text-red-800 dark:text-red-300' : 'text-stone-800 dark:text-stone-100'}`}>
                                <div className="font-medium">{e.oil.name}</div>
                                <div className="text-[10px] italic text-stone-400 dark:text-stone-500">{e.oil.botanicalName}</div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <NumberStepper
                                  value={drops}
                                  min={1}
                                  max={100}
                                  onChange={(v) => updateDrops(e.oil.id, v)}
                                  over={over}
                                  ariaLabel={`${e.oil.name} drops`}
                                />
                              </td>
                              <td className={`px-3 py-2 text-right font-mono ${numClass}`}>{volMl.toFixed(1)}</td>
                              <td className={`px-3 py-2 text-right font-mono ${numClass}`}>{pctDisplay}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => removeEO(e.oil.id)}
                                  className="rounded-full p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 dark:text-stone-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                                  aria-label={`Remove ${e.oil.name}`}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="border-t border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800">
                        <tr>
                          <td className="px-3 py-2 font-medium text-stone-700 dark:text-stone-200">Total</td>
                          <td className="px-3 py-2 text-right font-mono font-medium text-stone-700 dark:text-stone-200">
                            {selectedEOs.reduce((s, e) => s + pctToDrops(e.percentagePct, totalVolumeMl), 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-medium text-stone-700 dark:text-stone-200">
                            {calc.essentialOilTotalMl.toFixed(1)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-medium text-stone-700 dark:text-stone-200">
                            {(dilutionRate * 100).toFixed(1)}%
                          </td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                {selectedEOs.length > 0 && (
                  <p className="mt-2 text-[10px] text-stone-400 dark:text-stone-500">
                    Dilution set automatically from drops (1 ml = 20 drops)
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setActiveTab(4)}
                  disabled={!hasBlend}
                  className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Tab 4 — Save */}
          {activeTab === 4 && (
            <div className="space-y-4">
              <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">{activeTabSpec.fullLabel}</h2>

              {calc.ingredients.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">Recipe summary</p>
                  <QuantityTable ingredients={calc.ingredients} totalVolumeMl={totalVolumeMl} />
                </div>
              )}

              <div className="space-y-3 border-t border-stone-100 pt-4 dark:border-stone-700">
                <Input
                  label="Name your blend"
                  placeholder="e.g. Evening Calm"
                  value={blendName}
                  onChange={(e) => setBlendName(e.target.value)}
                  maxLength={100}
                />

                <Textarea
                  label="Notes (optional)"
                  rows={3}
                  placeholder="Intended use, application method, personal notes…"
                  value={blendNotes}
                  onChange={(e) => setBlendNotes(e.target.value)}
                  maxLength={2000}
                />

                {saveError && <Alert variant="unsafe">{saveError}</Alert>}

                <Button
                  className="w-full"
                  onClick={handleSave}
                  disabled={!canSave || saving}
                >
                  {saving ? 'Saving…' : 'Save & Get Recipe Card'}
                </Button>

                {!savable && (
                  <p className="text-center text-xs text-stone-400 dark:text-stone-500">
                    {selectedCarriers.length === 0 && selectedEOs.length >= 2
                      ? 'Add a carrier oil — essential-oil-only blends cannot be saved.'
                      : 'Add at least two oils (with at least one carrier) to save your blend.'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right column on desktop / below on mobile: selected oils + compatibility ── */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <SelectedOilsCard
          carriers={selectedCarriers.map((c) => ({ id: c.oil.id, name: c.oil.name }))}
          essentials={selectedEOs.map((e) => ({ id: e.oil.id, name: e.oil.name }))}
          onRemoveCarrier={removeCarrier}
          onRemoveEO={removeEO}
          onReset={handleReset}
        />

        <Card>
          <CardHeader>
            <h2 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-200">Compatibility</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {unsafePairings.length > 0 && (
              <Alert variant="unsafe" title="Unsafe combination">
                This blend cannot be saved. Remove the conflicting oils.
              </Alert>
            )}

            {avoidPairings.length > 0 && unsafePairings.length === 0 && !avoidAcknowledged && (
              <Alert variant="avoid" title="Not recommended">
                One or more pairings are not recommended.{' '}
                <button
                  className="mt-2 font-medium underline underline-offset-2"
                  onClick={() => setAvoidAcknowledged(true)}
                >
                  I understand — proceed anyway
                </button>
              </Alert>
            )}

            {calc.warnings.map((w, i) => (
              <Alert key={i} variant="caution">{w}</Alert>
            ))}

            {hasBlend && <CompatibilityPanel grade={score.grade} summary={score.summary} pairings={pairings} />}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
