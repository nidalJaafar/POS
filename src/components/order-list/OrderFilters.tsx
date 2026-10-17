'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowDownUp, CalendarDays, X } from 'lucide-react'

const PERIODS = [
  { label: 'All time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'This year', value: 'year' },
] as const

export default function OrderFilters() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const hasDates = Boolean(from || to)
  // A picked date range replaces the period buttons
  const period = hasDates ? null : (searchParams.get('period') ?? 'all')
  const sort = searchParams.get('sort') ?? 'desc'

  function href(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)))
    params.delete('page')
    return `${pathname}?${params.toString()}`
  }

  function pickDate(key: 'from' | 'to', value: string) {
    router.push(href({ [key]: value || null, period: null }))
  }

  const pillBase = 'rounded-xl px-3 py-1.5 text-xs font-medium transition-all'
  const dateInput =
    'rounded-xl bg-surface px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map(({ label, value }) => (
          <Link
            key={value}
            href={href({ period: value, from: null, to: null })}
            className={`${pillBase} ${
              period === value
                ? 'bg-primary text-primary-ink shadow-sm'
                : 'bg-surface text-ink-light shadow-sm hover:bg-panel-light hover:text-ink'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-xl p-1 ${hasDates ? 'bg-primary' : ''}`}
      >
        <CalendarDays className={`ml-1 w-4 ${hasDates ? 'text-primary-ink' : 'text-ink-light'}`} aria-hidden />
        <input
          type="date"
          aria-label="From date"
          value={from}
          max={to || undefined}
          onChange={(e) => pickDate('from', e.target.value)}
          className={dateInput}
        />
        <span className={`text-xs ${hasDates ? 'text-primary-ink' : 'text-ink-light'}`}>to</span>
        <input
          type="date"
          aria-label="To date"
          value={to}
          min={from || undefined}
          onChange={(e) => pickDate('to', e.target.value)}
          className={dateInput}
        />
        {hasDates && (
          <Link
            href={href({ from: null, to: null })}
            aria-label="Clear dates"
            className="rounded-lg p-1 text-primary-ink hover:bg-primary-dark"
          >
            <X className="w-3.5" />
          </Link>
        )}
      </div>

      <Link
        href={href({ sort: sort === 'desc' ? 'asc' : 'desc' })}
        className="ml-auto flex items-center gap-1.5 rounded-xl bg-surface px-3 py-1.5 text-xs font-medium text-ink-light shadow-sm hover:bg-panel-light hover:text-ink transition-all"
      >
        <ArrowDownUp className="w-3.5" />
        {sort === 'desc' ? 'Newest first' : 'Oldest first'}
      </Link>
    </div>
  )
}
