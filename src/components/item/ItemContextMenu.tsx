'use client'
import { updateIsDeleted } from '@/lib/actions'
import { Item } from '@/lib/dto'
import { useItems } from '@/lib/context/ItemsContext'
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

export default function ItemContextMenu({ item, isOpen, handleIsOpen, onEdit, deleted }: Params) {
  const { toggleItemDeleted } = useItems()
  const portalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const div = document.createElement('div')
    portalRef.current = div
    document.body.appendChild(div)
    return () => { document.body.removeChild(div) }
  }, [])

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    handleIsOpen()
  }

  async function handleDelete() {
    toggleItemDeleted(item.id, true)
    try {
      await updateIsDeleted(item.id, true)
    } catch {
      toggleItemDeleted(item.id, false)
    }
  }

  async function handleRestore() {
    toggleItemDeleted(item.id, false)
    try {
      await updateIsDeleted(item.id, false)
    } catch {
      toggleItemDeleted(item.id, true)
    }
  }

  function handleEdit() {
    if (!onEdit) return
    onEdit(item)
    window.scrollTo(0, 0)
  }

  return (
    <>
      {isOpen && portalRef.current && createPortal(
        <div className="fixed inset-0 z-10 cursor-pointer" onClick={handleClick} />,
        portalRef.current
      )}
      <div
        role="button"
        aria-label={`Actions for ${item.name}`}
        onClick={handleClick}
        className={`relative w-fit cursor-pointer self-end rounded-full p-1 transition-colors hover:bg-primary-light ${
          isOpen ? 'bg-primary-light' : 'bg-panel'
        }`}
      >
        <EllipsisVertical className="w-4" />
        <div
          className={`absolute -right-5 top-8 z-20 flex flex-col transition-opacity duration-100 ${
            isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {deleted ? (
            <button
              aria-label={`Restore ${item.name}`}
              onClick={handleRestore}
              className="flex w-8 items-center justify-center rounded-xl bg-success p-2 text-success-ink"
            >
              <Check className="w-4" />
            </button>
          ) : (
            <>
              {onEdit && (
                <button
                  aria-label={`Edit ${item.name}`}
                  onClick={handleEdit}
                  className="flex w-8 items-center justify-center rounded-t-xl bg-primary-light p-2"
                >
                  <Pencil className="w-4" />
                </button>
              )}
              <button
                aria-label={`Delete ${item.name}`}
                onClick={handleDelete}
                className={`flex w-8 items-center justify-center bg-danger text-danger-ink p-2 ${onEdit ? 'rounded-b-xl' : 'rounded-xl'}`}
              >
                <Trash className="w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
