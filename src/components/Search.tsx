'use client'
import React, { useEffect, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'

interface Params {
  onSearch: (query: string) => void
  placeholder?: string
  defaultValue?: string
}

export default function Search({ onSearch, placeholder = 'Search', defaultValue = '' }: Params) {
  const [query, setQuery] = useState(defaultValue)

  // Follow the URL when it changes elsewhere (e.g. the Completed tab clears ?q=)
  useEffect(() => setQuery(defaultValue), [defaultValue])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onSearch(e.target.value)
  }

  return (
    <div className="relative w-full sm:w-64">
      <SearchIcon className="absolute left-3 top-1/2 w-4 -translate-y-1/2 text-ink-light" />
      <input
        className="w-full rounded-xl bg-surface px-4 py-3 pl-9 text-sm font-normal placeholder:text-ink-light shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
      />
    </div>
  )
}
