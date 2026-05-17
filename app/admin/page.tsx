import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin' }

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const oils = await prisma.oil.findMany({
    where: q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { botanicalName: { contains: q, mode: 'insensitive' } },
      ],
    } : undefined,
    select: { id: true, name: true, botanicalName: true, type: true, buyUrl: true, imageUrl: true, enrichedAt: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-100">Oil Admin</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {oils.length} oil{oils.length === 1 ? '' : 's'}{q ? ` matching "${q}"` : ' in the library'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {process.env.ANTHROPIC_API_KEY && (
            <Link
              href="/admin/oils/new"
              className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              + Add with AI
            </Link>
          )}
          <Link
            href="/admin/oils/new/manual"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            + Add Manually
          </Link>
        </div>
      </div>

      {/* Search */}
      <form method="GET" className="mb-6 flex items-center gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name or botanical name…"
          className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500 md:text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-stone-700 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 dark:bg-stone-600 dark:hover:bg-stone-500"
        >
          Search
        </button>
        {q && (
          <Link
            href="/admin"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Clear
          </Link>
        )}
      </form>

      {oils.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
          No oils found{q ? ` for "${q}"` : ''}.
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <ul className="space-y-2 sm:hidden">
            {oils.map((oil) => (
              <li key={oil.id} className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-stone-900 dark:text-stone-100">{oil.name}</div>
                    <div className="italic text-xs text-stone-500 dark:text-stone-400">{oil.botanicalName}</div>
                  </div>
                  <Badge variant={oil.type === 'ESSENTIAL' ? 'GOOD' : 'default'}>
                    {oil.type === 'ESSENTIAL' ? 'Essential' : 'Carrier'}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                  <span>
                    Enriched:{' '}
                    {oil.enrichedAt
                      ? <span className="text-emerald-600 dark:text-emerald-500">✓</span>
                      : <span className="text-amber-500 dark:text-amber-400">—</span>}
                  </span>
                  <span>
                    Buy:{' '}
                    {oil.buyUrl
                      ? <span className="text-emerald-600 dark:text-emerald-500">✓</span>
                      : '—'}
                  </span>
                  <span>
                    Image:{' '}
                    {oil.imageUrl
                      ? <span className="text-emerald-600 dark:text-emerald-500">✓</span>
                      : '—'}
                  </span>
                </div>
                <div className="mt-2 flex justify-end">
                  <Link
                    href={`/admin/oils/${oil.id}`}
                    className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-stone-600 dark:text-amber-500 dark:hover:bg-amber-950"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-stone-200 bg-white sm:block dark:border-stone-700 dark:bg-stone-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left dark:border-stone-700 dark:bg-stone-900">
                  <th className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-300">Name</th>
                  <th className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-300">Botanical</th>
                  <th className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-300">Type</th>
                  <th className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-300">Enriched</th>
                  <th className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-300">Buy</th>
                  <th className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-300">Image</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
                {oils.map((oil) => (
                  <tr key={oil.id} className="hover:bg-stone-50 dark:hover:bg-stone-700/50">
                    <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">{oil.name}</td>
                    <td className="px-4 py-3 italic text-stone-500 dark:text-stone-400">{oil.botanicalName}</td>
                    <td className="px-4 py-3">
                      <Badge variant={oil.type === 'ESSENTIAL' ? 'GOOD' : 'default'}>
                        {oil.type === 'ESSENTIAL' ? 'Essential' : 'Carrier'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {oil.enrichedAt
                        ? <span className="text-emerald-600 dark:text-emerald-500">✓</span>
                        : <span className="text-amber-500 dark:text-amber-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-stone-400 dark:text-stone-500">
                      {oil.buyUrl ? <span className="text-emerald-600 dark:text-emerald-500">✓</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-stone-400 dark:text-stone-500">
                      {oil.imageUrl ? <span className="text-emerald-600 dark:text-emerald-500">✓</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/oils/${oil.id}`}
                        className="rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-950"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
