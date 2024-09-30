'use client'
import { updateIsDeleted } from '@/lib/actions'
import { Item } from '@/lib/dto'
import { addItemToMenu, removeItemFromMenu } from '@/lib/store/item/itemSlice'
import { useAppDispatch } from '@/lib/store/reduxHooks'
import { Check, EllipsisVertical, Pencil, Trash } from 'lucide-react'

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Params {
  item: Item
  isOpen: boolean
  handleIsOpen: () => void
  onEdit?: (item: Item) => void
  deleted: boolean
}

export default function ItemContextMenu({
  item,
  isOpen,
  handleIsOpen,
  onEdit,
  deleted,
}: Params) {
  const dispatch = useAppDispatch()
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const div = document.createElement('div')
    ref.current = div
    document.body.appendChild(ref.current)

    return () => {
      if (ref.current) {
        document.body.removeChild(ref.current)
      }
    }
  }, [])

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation()
    handleIsOpen()
  }

  async function handleDelete(id: number) {
    try {
      dispatch(removeItemFromMenu(id))
      await updateIsDeleted(id, true)
    } catch (error) {
      console.error('Error deleting item:', error)
      dispatch(addItemToMenu(id))
    }
  }

  async function handleRestore(id: number) {
    try {
      dispatch(addItemToMenu(id))
      await updateIsDeleted(id, false)
    } catch (error) {
      console.error('Error restoring item:', error)
      dispatch(removeItemFromMenu(id))
    }
  }

  function handleEdit(item: Item) {
    if (!onEdit) return
    onEdit(item)
    window.scrollTo(0, 0)
  }

  // Ensure the portal is created only if ref.current is defined
  return (
    <>
      {isOpen &&
        ref.current &&
        createPortal(
          <div
            className={`z-5 fixed inset-0 cursor-pointer`}
            onClick={handleClick}
          ></div>,
          ref.current
        )}
      <div
        onClick={handleClick}
        className={`relative w-fit cursor-pointer self-end rounded-full p-1 hover:bg-sunflowerYellow-light ${isOpen ? 'bg-sunflowerYellow-light' : 'bg-beige'}`}
      >
        <EllipsisVertical className="w-5" />
        <div
          className={`absolute -right-5 top-8 z-10 transform flex-col items-center justify-center transition-opacity duration-100 ease-in-out ${
            isOpen
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none -z-0 opacity-0'
          }`}
        >
          {deleted ? (
            <div
              onClick={() => handleRestore(item.id)}
              className="flex w-8 cursor-pointer items-center justify-center rounded-xl bg-mintGreen p-2"
            >
              <Check />
            </div>
          ) : (
            <>
              {onEdit && (
                <div
                  className="flex w-8 cursor-pointer items-center justify-center rounded-t-xl bg-skyBlue p-2"
                  onClick={() => handleEdit(item)}
                >
                  <Pencil />
                </div>
              )}
              <div
                className="flex w-8 cursor-pointer items-center justify-center rounded-b-xl bg-pastelPink p-2"
                onClick={() => handleDelete(item.id)}
              >
                <Trash />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
