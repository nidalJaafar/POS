'use client'

import { completePendingOrder, deletePendingOrder } from '@/lib/actions'
import { Order } from '@/lib/dto'
import { Check, Pencil, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'

interface Params {
  order: Order
  handlePending: (isPending: boolean) => void
}

export default function OrderControls({ order, handlePending }: Params) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  useEffect(() => { handlePending(isPending) }, [handlePending, isPending])

  const btnBase = 'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all hover:brightness-95'

  return (
    <div className="flex overflow-hidden rounded-xl">
      <button
        onClick={() => startTransition(() => router.push(`/orders/edit/${order.id}`))}
        className={`${btnBase} rounded-l-xl bg-primary-light`}
      >
        <Pencil className="w-3.5" /> Edit
      </button>
      <button
        onClick={() => startTransition(() => completePendingOrder(order.id))}
        className={`${btnBase} bg-success text-success-ink`}
      >
        <Check className="w-3.5" /> Complete
      </button>
      <button
        onClick={() => startTransition(() => deletePendingOrder(order.id))}
        className={`${btnBase} rounded-r-xl bg-danger text-danger-ink`}
      >
        <Trash className="w-3.5" /> Delete
      </button>
    </div>
  )
}
