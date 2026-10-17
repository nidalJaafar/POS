'use client'

import { placeOrder } from '@/lib/actions'
import { Item, OrderItem } from '@/lib/dto'
import { currencyFormat, orderTotal } from '@/lib/util'
import { useTransition, useEffect, useRef, useState } from 'react'
import NewOrderItemCard from './NewOrderItemCard'
import { ShoppingBag } from 'lucide-react'

interface Props {
  cartItems: OrderItem[]
  onRemove: (item: Item) => void
  onQuantityChange: (itemId: number, quantity: number) => void
  setIsPending: (v: boolean) => void
  onClose?: () => void
}

// YYYY-MM-DD in the local time zone; toISOString() would give the UTC date
function localDateString(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function OrderItemsMenu({
  cartItems,
  onRemove,
  onQuantityChange,
  setIsPending,
  onClose,
}: Props) {
  const [date, setDate] = useState(localDateString)
  const [isPending, startTransition] = useTransition()
  // isPending only disables the button after a re-render; this blocks a fast second click
  const submitted = useRef(false)

  useEffect(() => { setIsPending(isPending) }, [isPending, setIsPending])
  // A failed order leaves the cart in place; allow trying again
  useEffect(() => { if (!isPending) submitted.current = false }, [isPending])

  const total = orderTotal(cartItems)

  return (
    <div className="flex w-80 flex-shrink-0 flex-col gap-5 rounded-2xl bg-surface p-7 self-start sticky top-8 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShoppingBag className="w-4" /> New Order
        </h2>
        {onClose && (
          <button onClick={onClose} className="text-sm text-ink-light hover:text-ink">
            Close
          </button>
        )}
      </div>

      <input
        aria-label="Order date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-xl bg-panel-light px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {cartItems.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-light">No items selected</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cartItems.map((item) => (
            <NewOrderItemCard
              key={item.id}
              item={item}
              onRemove={onRemove}
              onQuantityChange={onQuantityChange}
            />
          ))}
        </div>
      )}

      {cartItems.length > 0 && (
        <>
          <div className="flex justify-between text-sm font-medium">
            <span>Total</span>
            <span className="font-semibold">{currencyFormat(total)}</span>
          </div>
          <button
            onClick={() => {
              if (submitted.current) return
              submitted.current = true
              startTransition(() => placeOrder(cartItems, date))
            }}
            disabled={isPending}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-ink shadow-sm transition-all hover:bg-primary-dark disabled:opacity-60"
          >
            Place Order
          </button>
        </>
      )}
    </div>
  )
}
