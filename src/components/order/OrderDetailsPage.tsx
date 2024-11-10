'use client'

import { Order } from '@/lib/dto'
import { currencyFormat, dateFormat } from '@/lib/util'
import { useState } from 'react'
import Grid from '../Grid'
import ItemCard from '../item/ItemCard'
import Spinner from '../Spinner'
import OrderControls from './OrderControls'
import OrderStatus from './OrderStatus'

interface Params {
  order: Order
}

export default function OrderDetailsPage({ order }: Params) {
  const [pending, setPending] = useState(false)

  return (
    <div className="min-w-full self-start">
      <div className="mr-10 flex flex-col items-start justify-between gap-10 sm:flex-row sm:items-center sm:gap-0">
        <div className="flex items-center justify-start gap-5">
          <h3 className="text-2xl">#{order.id}</h3>
          <OrderStatus status={order.status} />
        </div>
        {order.status === 'pending' && (
          <OrderControls order={order} handlePending={setPending} />
        )}
        <p className="my-5">{dateFormat(order.created_at)}</p>
      </div>
      <p className="my-5 text-xl">Order Items</p>
      {pending ? (
        <div className="min-w-screen flex min-h-screen flex-col items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <Grid>
            <>
              {order.items.map((item) => (
                <ItemCard withQuantity key={item.id} item={item} />
              ))}
            </>
          </Grid>
          <p className="mt-5 text-xl">
            Total Price:{' '}
            {currencyFormat(
              order.items.reduce(
                (acc, item) => acc + item.quantity * item.price,
                0
              )
            )}
          </p>
        </>
      )}
    </div>
  )
}
