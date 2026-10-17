'use client'

import Image from 'next/image'
import { currencyFormat } from '@/lib/util'
import { Item, OrderItem } from '@/lib/dto'
import { Minus, Plus, X } from 'lucide-react'

interface Props {
  item: OrderItem
  onRemove: (item: Item) => void
  onQuantityChange: (itemId: number, quantity: number) => void
}

function NewOrderItemCard({ item, onRemove, onQuantityChange }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-panel p-3">
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
        <Image src={item.image} alt={item.name} fill className="object-cover" />
      </div>

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium">
          {item.name}
        </span>
        <span className="text-xs font-semibold text-ink">
          {currencyFormat(item.quantity * item.price)}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          aria-label={`Decrease ${item.name}`}
          onClick={() => onQuantityChange(item.id, item.quantity - 1)}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-panel-light hover:bg-panel-dark transition-colors"
        >
          <Minus className="w-3" />
        </button>
        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
        <button
          aria-label={`Increase ${item.name}`}
          onClick={() => onQuantityChange(item.id, item.quantity + 1)}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-panel-light hover:bg-panel-dark transition-colors"
        >
          <Plus className="w-3" />
        </button>
      </div>

      <button aria-label={`Remove ${item.name}`} onClick={() => onRemove(item)} className="text-ink-light hover:text-ink transition-colors">
        <X className="w-4" />
      </button>
    </div>
  )
}

export default NewOrderItemCard
