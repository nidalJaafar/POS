'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { Item } from '@/lib/dto'

interface ItemsContextValue {
  items: Item[]
  toggleItemDeleted: (itemId: number, deleted: boolean) => void
}

const ItemsContext = createContext<ItemsContextValue | null>(null)

export function ItemsProvider({
  items: initial,
  children,
}: {
  items: Item[]
  children: React.ReactNode
}) {
  const [items, setItems] = useState(initial)

  // Pick up fresh server data after an action revalidates the page
  useEffect(() => setItems(initial), [initial])

  function toggleItemDeleted(itemId: number, deleted: boolean) {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, deleted } : item))
    )
  }

  return (
    <ItemsContext.Provider value={{ items, toggleItemDeleted }}>
      {children}
    </ItemsContext.Provider>
  )
}

export function useItems(): ItemsContextValue {
  const ctx = useContext(ItemsContext)
  if (!ctx) throw new Error('useItems must be used within ItemsProvider')
  return ctx
}
