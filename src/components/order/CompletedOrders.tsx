'use client'

import React, { useEffect, useState } from 'react'
import Grid from '../Grid'
import { Order } from '@/lib/dto'
import OrderCard from '../order-list/OrderCard'

interface Params {
  orders: Order[]
}

export default function CompletedOrders({ orders }: Params) {
  const [search, setSearch] = useState<string>('')
  const [filteredOrders, setFilteredOrders] = useState<Order[]>(orders)

  useEffect(() => {
    setFilteredOrders(
      orders.filter((order) => String(order.id).includes(search))
    )
  }, [orders, search])

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
  }

  return (
    <>
      <input
        className="mb-5 w-full self-start rounded-xl bg-beige-light p-3 focus:outline-0 sm:w-fit"
        type="text"
        value={search}
        onChange={handleSearch}
        placeholder="Search"
      />
      <Grid className="w-full">
        <>
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </>
      </Grid>
    </>
  )
}
