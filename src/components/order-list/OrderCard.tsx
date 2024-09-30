'use client'

import { Order } from '@/lib/dto'
import { Ellipsis } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ContextMenu from './ContextMenu'
import { useState, useTransition } from 'react'
import Spinner from '../Spinner'

interface Params {
  order: Order
  withContextMenu?: boolean
  handleContextMenuPending?: (isPending: boolean) => void
}

export default function OrderCard({
  order,
  withContextMenu = false,
  handleContextMenuPending,
}: Params) {
  const router = useRouter()
  const [contextMenuOpen, setContextMenuOpen] = useState<boolean>(false)
  const [isPending, startTransition] = useTransition()
  function handleTransition(url: string) {
    startTransition(() => {
      router.push(url)
    })
  }
  return (
    <div
      onClick={() =>
        !contextMenuOpen && handleTransition(`/orders/${order.id}`)
      }
      className="relative flex cursor-pointer flex-col rounded-xl bg-beige-light p-5"
    >
      {isPending ? (
        <div className="flex h-full w-full items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          {withContextMenu && (
            <ContextMenu
              orderId={Number(order.id)}
              isOpen={contextMenuOpen}
              handleIsOpen={() => setContextMenuOpen((o) => !o)}
              setIsPending={handleContextMenuPending}
            />
          )}
          <div className="flex flex-col items-start justify-center">
            <p>
              <span className="text-sm font-thin">#</span>
              {order.id}
            </p>
          </div>
          <div className="mt-2 flex flex-col items-start justify-center rounded-xl bg-beige p-2">
            <ul>
              {order.items.slice(0, 3).map((item) => (
                <li
                  key={item.id}
                  className="sm:max-w-42 max-w-28 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  {item.name}
                </li>
              ))}
            </ul>
            {order.items.length > 3 && <Ellipsis className="w-5" />}
          </div>
        </>
      )}
    </div>
  )
}
