'use client'

import React, { useEffect, useState } from 'react'
import Grid from '../Grid'
import { Order } from '@/lib/dto'
import OrderCard from '../order-list/OrderCard'
import { dateFormat } from '../../lib/util'

interface Params {
  orders: [string, Order[]][]
}

export default function CompletedOrders({ orders }: Params) {
  const [search, setSearch] = useState<string>('')
  const [filteredOrders, setFilteredOrders] = useState<
    { date: string; orders: Order[] }[]
  >([])

  useEffect(() => {
    const lowercasedSearch = search.toLowerCase()

    const filtered = orders.flatMap(([date, orderList]) => {
      const filteredBySearch = orderList.filter((order) =>
        String(order.id).includes(lowercasedSearch)
      )

      if (filteredBySearch.length > 0) {
        return [{ date, orders: filteredBySearch }]
      }
      return []
    })

    setFilteredOrders(filtered)
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
      {filteredOrders.map(({ date, orders }) => (
        <div key={date}>
          <h2 className="mb-5 text-2xl font-bold">{dateFormat(date)}</h2>
          <Grid className="w-full">
            <>
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </>
          </Grid>
        </div>
      ))}
    </>
  )
}
