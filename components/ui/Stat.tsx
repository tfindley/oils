// Compact at-a-glance metric tile used in admin/users + my-collection stats
// strips. `value` accepts a string (preformatted, e.g. currency) or a number
// (formatted with .toLocaleString()). The `amber` tone is for "something
// needs the operator's eye" — e.g. users with pending purge warnings.

interface StatProps {
  label: string
  value: string | number
  sublabel?: string
  tone?: 'default' | 'amber'
}

export function Stat({ label, value, sublabel, tone = 'default' }: StatProps) {
  const display = typeof value === 'number' ? value.toLocaleString() : value
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        tone === 'amber'
          ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
          : 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800'
      }`}
    >
      <div
        className={`text-xs font-medium uppercase tracking-wider ${
          tone === 'amber'
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-stone-500 dark:text-stone-400'
        }`}
      >
        {label}
      </div>
      <div className="mt-0.5 font-serif text-xl font-semibold text-stone-900 dark:text-stone-100">
        {display}
      </div>
      {sublabel && (
        <div className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">{sublabel}</div>
      )}
    </div>
  )
}
