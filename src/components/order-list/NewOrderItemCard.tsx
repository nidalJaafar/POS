'use client'

import Image from 'next/image'
import { currencyFormat } from '@/lib/util'
import { Item, OrderItem } from '@/lib/dto'
import { useState } from 'react'
import { CircleX, Minus, Plus } from 'lucide-react'

interface Props {
  item: OrderItem
  onRemove: (item: Item) => void
}

function NewOrderItemCard({ item, onRemove }: Props) {
  const [quantity, setQuantity] = useState(1)
  const price = quantity * item.price

  function handleMinus() {
    if (quantity === 1) onRemove(item)
    else setQuantity((q) => q - 1)
    item.quantity -= 1
  }

  function handlePlus() {
    setQuantity((q) => q + 1)
    item.quantity += 1
  }

  return (
    <div className="flex min-w-full items-start justify-between rounded-xl bg-beige p-5">
      <div className="relative mr-5 aspect-square w-20 self-center">
        <Image src={item.image} alt={item.name} fill className="object-cover" />
      </div>
      <div className="flex flex-col items-center justify-center gap-10">
        <div className="w-24 overflow-hidden text-ellipsis whitespace-nowrap text-center">
          {item.name}
        </div>
        <div className="flex w-20 items-center justify-between gap-2">
          <Minus className="cursor-pointer" onClick={handleMinus} />
          <div className="w-14 text-center">{quantity}</div>
          <Plus className="cursor-pointer" onClick={handlePlus} />
        </div>
      </div>
      <div className="flex flex-col items-center gap-10">
        <div className="w-14 justify-self-start text-center">
          {currencyFormat(price)}
        </div>
        <CircleX
          className="w-7 cursor-pointer"
          onClick={() => onRemove(item)}
        />
      </div>
    </div>
  )
}

export default NewOrderItemCard
