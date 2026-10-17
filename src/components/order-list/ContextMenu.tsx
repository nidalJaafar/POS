'use client'
import { completePendingOrder, deletePendingOrder } from '@/lib/actions'
import { Check, EllipsisVertical, Pencil, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'

interface Params {
  orderId: number
  isOpen: boolean
  handleIsOpen: () => void
  setIsPending?: (isPending: boolean) => void
}

export default function ContextMenu({ orderId, isOpen, handleIsOpen, setIsPending }: Params) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  useEffect(() => { setIsPending?.(isPending) }, [isPending, setIsPending])

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    handleIsOpen()
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-10 ${isOpen ? 'cursor-pointer' : 'pointer-events-none'}`}
        onClick={handleClick}
      />
      <button
        aria-label={`Actions for order ${orderId}`}
        onClick={handleClick}
        className={`absolute right-3 top-3 z-20 rounded-full p-1.5 transition-colors hover:bg-primary-light ${
          isOpen ? 'bg-primary-light' : 'bg-panel'
        }`}
      >
        <EllipsisVertical className="w-4" />
      </button>

      <div
        className={`absolute right-3 top-12 z-20 flex flex-col overflow-hidden rounded-xl shadow-lg transition-all duration-150 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <button
          onClick={() => startTransition(() => router.push(`/orders/edit/${orderId}`))}
          className="flex items-center gap-2 bg-primary-light px-3 py-2 text-xs font-medium hover:brightness-95"
        >
          <Pencil className="w-3.5" /> Edit
        </button>
        <button
          onClick={() => startTransition(() => completePendingOrder(orderId))}
          className="flex items-center gap-2 bg-success px-3 py-2 text-xs text-success-ink font-medium hover:brightness-95"
        >
          <Check className="w-3.5" /> Complete
        </button>
        <button
          onClick={() => startTransition(() => deletePendingOrder(orderId))}
          className="flex items-center gap-2 bg-danger text-danger-ink px-3 py-2 text-xs font-medium hover:brightness-95"
        >
          <Trash className="w-3.5" /> Delete
        </button>
      </div>
    </>
  )
}
