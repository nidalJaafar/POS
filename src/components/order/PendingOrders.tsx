'use client'

import React, { useState } from 'react'
import Grid from '../Grid'
import OrderCard from '../order-list/OrderCard'
import { Order } from '@/lib/dto'
import Spinner from '../Spinner'

interface Params {
  orders: Order[]
}

export default function PendingOrders({ orders }: Params) {
  const [isPending, setIsPending] = useState<boolean>(false)
  return isPending ? (
    <div className="min-w-screen flex min-h-screen flex-col items-center justify-center">
      <Spinner />
    </div>
  ) : (
    <Grid className="w-full">
      <>
        {orders.map((order) => (
          <OrderCard
            order={order}
            withContextMenu
            key={order.id}
            handleContextMenuPending={setIsPending}
          />
        ))}
      </>
    </Grid>
  )
}
