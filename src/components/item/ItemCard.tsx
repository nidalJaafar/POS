'use client'

import placeholder from '@/../public/icon.png'
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
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const clickable = !deleted && !isDisabled && !!onSelect

  function handleClick() {
    if (!clickable) return
    onSelect!({ ...item, quantity: 1 })
  }

  // hover:scale makes the card its own stacking context, which would trap the menu below
  // its full-screen click-catcher (z-10); lifting the card while the menu is open keeps
  // Edit/Delete clickable
  return (
    <div
      onClick={handleClick}
      className={`relative flex flex-col rounded-2xl bg-surface p-4 shadow-sm transition-all
        ${clickable ? 'cursor-pointer hover:scale-[1.02] hover:shadow-md' : 'cursor-default'}
        ${contextMenuOpen ? 'z-30' : ''}
        ${isDisabled ? 'opacity-50' : ''}`}
    >
      {withContextMenu && (
        <ItemContextMenu
          item={item}
          isOpen={contextMenuOpen}
          handleIsOpen={() => {
            if (!isDisabled) setContextMenuOpen((o) => !o)
          }}
          deleted={deleted}
          onEdit={onEdit}
        />
      )}

      <div className="relative mb-4 aspect-square w-full overflow-hidden rounded-xl">
        <Image
          src={item.image ? encodeURI(item.image) : placeholder}
          alt={item.name}
          fill
          className="object-cover"
        />
      </div>

      <div className="flex flex-col items-center gap-0.5 text-center">
        {children}
        <span className="text-sm font-semibold text-ink">
          {currencyFormat(item.price)}
          {'quantity' in item && withQuantity && (
            <> <X className="inline w-3" /> {(item as OrderItem).quantity}</>
          )}
        </span>
        <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-normal text-ink-light">
          {item.name}
        </span>
      </div>
    </div>
  )
}

export default ItemCard
