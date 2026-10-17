'use client'
import Grid from '@/components/Grid'
import { updateOrderItemsAction } from '@/lib/actions'
import { useItems } from '@/lib/context/ItemsContext'
import { Item, Order, OrderItem } from '@/lib/dto'
import { currencyFormat, orderTotal } from '@/lib/util'
import { useState, useTransition } from 'react'
import ItemCard from '../item/ItemCard'
import { Minus, Plus } from 'lucide-react'
import Spinner from '../Spinner'

function ItemGallery({
  items,
  orderItems,
  onAdd,
  onClose,
}: {
  items: Item[]
  orderItems: OrderItem[]
  onAdd: (item: OrderItem) => void
  onClose: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onClose}
        className="w-fit rounded-xl bg-primary px-4 py-2 text-sm font-medium"
      >
        Done
      </button>
      <Grid>
        <>
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isDisabled={orderItems.some((i) => i.id === item.id)}
              onSelect={() => onAdd({ ...item, quantity: 1 })}
            />
          ))}
        </>
      </Grid>
    </div>
  )
}

export default function EditPage({ order: initialOrder }: { order: Order }) {
  const { items: allItems } = useItems()
  const items = allItems.filter((item) => !item.deleted)

  const [orderItems, setOrderItems] = useState<OrderItem[]>(initialOrder.items)
  const [showGallery, setShowGallery] = useState(false)
  const [isPending, startTransition] = useTransition()

  function adjustQuantity(itemId: number, delta: number) {
    setOrderItems((prev) =>
      prev.flatMap((item) => {
        if (item.id !== itemId) return [item]
        const next = item.quantity + delta
        return next < 1 ? [] : [{ ...item, quantity: next }]
      })
    )
  }

  function addItem(item: OrderItem) {
    setOrderItems((prev) => [...prev, item])
  }

  const order: Order = { ...initialOrder, items: orderItems }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold">#{initialOrder.id}</h2>
        <span className="text-sm text-ink-light">Editing</span>
      </div>

      {showGallery ? (
        <ItemGallery
          items={items}
          orderItems={orderItems}
          onAdd={(item) => { addItem(item); setShowGallery(false) }}
          onClose={() => setShowGallery(false)}
        />
      ) : isPending ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <h3 className="text-sm font-medium uppercase tracking-wide text-ink-light">Order Items</h3>
          <Grid>
            <>
              {orderItems.map((item) => (
                <ItemCard key={item.id} item={item}>
                  <div className="flex items-center gap-2 py-1">
                    <button
                      aria-label={`Decrease ${item.name}`}
                      onClick={(e) => { e.stopPropagation(); adjustQuantity(item.id, -1) }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-panel hover:bg-panel-dark transition-colors"
                    >
                      <Minus className="w-3" />
                    </button>
                    <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      aria-label={`Increase ${item.name}`}
                      onClick={(e) => { e.stopPropagation(); adjustQuantity(item.id, 1) }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-panel hover:bg-panel-dark transition-colors"
                    >
                      <Plus className="w-3" />
                    </button>
                  </div>
                </ItemCard>
              ))}

              <button
                onClick={() => setShowGallery(true)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-panel-dark p-6 text-ink-light transition-all hover:border-primary hover:text-ink"
              >
                <Plus className="w-8 h-8" />
                <span className="text-sm">Add Item</span>
              </button>
            </>
          </Grid>

          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">
              Total: {currencyFormat(orderTotal(orderItems))}
            </p>
            <form action={() => startTransition(() => updateOrderItemsAction(order))}>
              <button
                type="submit"
                disabled={orderItems.length === 0}
                title={orderItems.length === 0 ? 'Add at least one item' : undefined}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-ink shadow-sm transition-all hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Changes
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
