'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Props {
  currentPage: number
  totalPages: number
}

export default function Pagination({ currentPage, totalPages }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [input, setInput] = useState(String(currentPage))

  useEffect(() => setInput(String(currentPage)), [currentPage])

  if (totalPages <= 1) return null

  function href(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    return `${pathname}?${params.toString()}`
  }

  function handleJump(e: React.FormEvent) {
    e.preventDefault()
    const page = Math.min(totalPages, Math.max(1, Math.trunc(Number(input))))
    // An empty box (Number('') is 0) or anything unparseable just restores the current page
    if (!input.trim() || Number.isNaN(page) || page === currentPage) {
      setInput(String(currentPage))
      return
    }
    router.push(href(page))
  }

  const btnBase =
    'flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm transition-all'

  return (
    <div className="flex items-center justify-center gap-3">
      <Link
        href={href(currentPage - 1)}
        className={`${btnBase} bg-surface hover:bg-panel-light ${currentPage === 1 ? 'pointer-events-none opacity-40' : ''}`}
      >
        <ChevronLeft className="w-4" /> Previous
      </Link>

      <form onSubmit={handleJump} className="flex items-center gap-2">
        <input
          aria-label="Page number"
          type="number"
          min={1}
          max={totalPages}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={handleJump}
          className="w-16 rounded-xl bg-surface px-3 py-2 text-center text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <span className="text-sm text-ink-light">of {totalPages}</span>
      </form>

      <Link
        href={href(currentPage + 1)}
        className={`${btnBase} bg-surface hover:bg-panel-light ${currentPage === totalPages ? 'pointer-events-none opacity-40' : ''}`}
      >
        Next <ChevronRight className="w-4" />
      </Link>
    </div>
  )
}
