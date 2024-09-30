'use client'

import logo from '@/../public/logo.png'
import { Item, OrderItem } from '@/lib/dto'
import { currencyFormat } from '@/lib/util'
import Image from 'next/image'
import React, { useState } from 'react'
import ItemContextMenu from './ItemContextMenu'
import { X } from 'lucide-react'

interface Params {
  item: Item | OrderItem
  onSelect?: (item: OrderItem) => void
  isDisabled?: boolean
  deleted?: boolean
  onEdit?: (item: Item) => void
  withContextMenu?: boolean
  children?: React.ReactElement
  withQuantity?: boolean
}

function ItemCard({
  withQuantity = false,
  item,
  onSelect,
  isDisabled,
  deleted = false,
  onEdit,
  withContextMenu = false,
  children,
}: Params) {
  const [contextMenuOpen, setContextMenuOpen] = useState<boolean>(false)

  function handleClick(item: Item) {
    if (isDisabled || !onSelect) return
    onSelect({ ...item, quantity: 1 })
  }

  function handleOpen() {
    if (isDisabled) return
    setContextMenuOpen((o) => !o)
  }

  return (
    <div
      onClick={() => handleClick(item)}
      className={`relative flex h-max w-full flex-col items-center justify-center rounded-xl bg-beige-light px-5 py-2 ${isDisabled ? 'opacity-50' : ''} ${deleted || isDisabled || !onSelect ? 'cursor-default' : 'cursor-pointer'}`}
    >
      {withContextMenu && (
        <ItemContextMenu
          item={item}
          isOpen={contextMenuOpen}
          handleIsOpen={handleOpen}
          deleted={deleted}
          onEdit={onEdit}
        />
      )}
      <div className="flex flex-1 flex-col items-center justify-between">
        <div className="relative my-3 aspect-square w-32 sm:w-40">
          <Image
            src={item.image ?? logo}
            alt={item.name}
            fill
            className="rounded-xl object-cover"
          />
        </div>
        <div className="flex flex-col items-center justify-center">
          {children}
          <div className="flex items-center justify-center gap-2">
            {currencyFormat(item.price)}
            {'quantity' in item && withQuantity && (
              <>
                <X className="inline w-4" /> {item.quantity}
              </>
            )}
          </div>
          <div className="max-w-36 overflow-hidden text-ellipsis whitespace-nowrap text-center text-lg">
            {item.name}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ItemCard
