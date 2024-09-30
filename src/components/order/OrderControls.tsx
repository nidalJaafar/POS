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
  useEffect(() => {
    handlePending(isPending)
  }, [handlePending, isPending])
  const iconClass = 'w-5'
  const controlClass =
    'flex max-h-12 cursor-pointer items-center justify-center gap-2 p-2'
  return (
    <div className="flex items-center justify-center rounded-xl">
      <div
        className={`bg-skyBlue ${controlClass} rounded-l-lg`}
        onClick={() =>
          startTransition(() => router.push(`/orders/edit/${order.id}`))
        }
      >
        <Pencil className={iconClass} /> Edit
      </div>
      <div
        className={`bg-mintGreen ${controlClass}`}
        onClick={() =>
          startTransition(() => completePendingOrder(Number(order.id)))
        }
      >
        <Check className={iconClass} /> Complete
      </div>
      <div
        className={`bg-pastelPink ${controlClass} rounded-r-lg`}
        onClick={() =>
          startTransition(() => deletePendingOrder(Number(order.id)))
        }
      >
        <Trash className={iconClass} /> Delete
      </div>
    </div>
  )
}
