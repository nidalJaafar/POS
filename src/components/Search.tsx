'use client'
import { Item } from '@/lib/dto'
import { useAppSelector } from '@/lib/store/reduxHooks'
import React, { useCallback, useEffect, useState } from 'react'

interface Params {
  handleFilteredItems: (value: Item[]) => void
}

export default function Search({ handleFilteredItems }: Params) {
  const items = useAppSelector((state) => state.items)
  const [search, setSearch] = useState<string>('')

  const filter = useCallback(
    (value: string) => {
      return items.filter((item: Item) =>
        item.name.toLowerCase().includes(value.toLowerCase())
      )
    },
    [items]
  )

  useEffect(() => {
    if (!search) return
    const timeoutId = setTimeout(() => {
      handleFilteredItems(filter(search))
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [filter, handleFilteredItems, search])

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
  }
  return (
    <input
      className="w-full rounded-xl bg-beige-light p-3 focus:outline-0 sm:w-fit"
      type="text"
      value={search}
      onChange={handleSearch}
      placeholder="Search"
    />
  )
}
