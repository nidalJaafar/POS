'use client'

import Grid from '../Grid'
import OrderCard from '../order-list/OrderCard'
import { Order } from '@/lib/dto'
import Spinner from '../Spinner'
import Pagination from '../Pagination'
import OrderFilters from '../order-list/OrderFilters'
import { useState } from 'react'

interface Props {
  orders: Order[]
  currentPage: number
  totalPages: number
}

export default function PendingOrders({
  orders,
  currentPage,
  totalPages,
}: Props) {
  const [isPending, setIsPending] = useState(false)

  // The order cards stay mounted (hidden) while an action runs: they own the
  // transition, and unmounting them would leave the spinner up if it fails
  return (
    <>
      {isPending && (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner />
        </div>
      )}
      <div
        className={`${isPending ? 'hidden' : 'flex'} min-h-[calc(100vh-14rem)] flex-col gap-6`}
      >
        <OrderFilters />

        <div className="flex-1">
          {orders.length === 0 ? (
            <p className="text-sm text-ink-light">No pending orders.</p>
          ) : (
            <Grid className="w-full">
              <>
                {orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    withContextMenu
                    handleContextMenuPending={setIsPending}
                  />
                ))}
              </>
            </Grid>
          )}
        </div>

        <div className="mt-auto pt-4">
          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </div>
      </div>
    </>
  )
}
