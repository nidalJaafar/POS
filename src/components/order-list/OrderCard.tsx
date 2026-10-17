'use client'

import { Order } from '@/lib/dto'
import { currencyFormat, orderTotal } from '@/lib/util'
import { useRouter } from 'next/navigation'
import ContextMenu from './ContextMenu'
import { useState, useTransition } from 'react'
import Spinner from '../Spinner'
import { Ellipsis } from 'lucide-react'

interface Params {
  order: Order
  withContextMenu?: boolean
  handleContextMenuPending?: (isPending: boolean) => void
}

export default function OrderCard({ order, withContextMenu = false, handleContextMenuPending }: Params) {
  const router = useRouter()
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function navigate() {
    if (!contextMenuOpen) startTransition(() => router.push(`/orders/${order.id}`))
  }

  const total = orderTotal(order.items)

  return (
    <div
      onClick={navigate}
      className="relative flex cursor-pointer flex-col gap-4 rounded-2xl bg-surface p-5 shadow-sm transition-all hover:shadow-md"
    >
      {isPending ? (
        <div className="flex h-24 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          {withContextMenu && (
            <ContextMenu
              orderId={order.id}
              isOpen={contextMenuOpen}
              handleIsOpen={() => setContextMenuOpen((o) => !o)}
              setIsPending={handleContextMenuPending}
            />
          )}

          <div className="flex items-baseline gap-1">
            <span className="text-xs text-ink-light">#</span>
            <span className="text-lg font-semibold">{order.id}</span>
          </div>

          <div className="rounded-xl bg-panel p-3">
            <ul className="flex flex-col gap-1">
              {order.items.slice(0, 3).map((item) => (
                <li key={item.id} className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-ink-light">
                  {item.quantity}× {item.name}
                </li>
              ))}
              {order.items.length > 3 && <Ellipsis className="w-4 text-ink-light" />}
            </ul>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-light">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
            <span className="text-sm font-semibold">{currencyFormat(total)}</span>
          </div>
        </>
      )}
    </div>
  )
}
