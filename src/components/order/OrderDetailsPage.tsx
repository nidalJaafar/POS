'use client'

import { Order } from '@/lib/dto'
import { currencyFormat, dateFormat, orderTotal } from '@/lib/util'
import { useState } from 'react'
import Grid from '../Grid'
import ItemCard from '../item/ItemCard'
import Spinner from '../Spinner'
import OrderControls from './OrderControls'
import OrderStatus from './OrderStatus'

export default function OrderDetailsPage({ order }: { order: Order }) {
  const [pending, setPending] = useState(false)

  // The controls stay mounted (hidden) while an action runs: they own the transition,
  // and unmounting them would leave the spinner up if it fails
  return (
    <>
      {pending && (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner />
        </div>
      )}
      <div className={`${pending ? 'hidden' : 'flex'} flex-col gap-8`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">#{order.id}</h2>
            <OrderStatus status={order.status} />
          </div>
          {order.status === 'pending' && (
            <OrderControls order={order} handlePending={setPending} />
          )}
        </div>

        <p className="text-sm text-ink-light">{dateFormat(order.created_at)}</p>

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-medium uppercase tracking-wide text-ink-light">
            Order Items
          </h3>
          <Grid>
            <>
              {order.items.map((item) => (
                <ItemCard key={item.id} item={item} withQuantity />
              ))}
            </>
          </Grid>
        </div>

        <div className="flex justify-end">
          <p className="text-lg font-semibold">
            Total: {currencyFormat(orderTotal(order.items))}
          </p>
        </div>
      </div>
    </>
  )
}
