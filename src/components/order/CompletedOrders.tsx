'use client'

import React, { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Grid from '../Grid'
import { Order } from '@/lib/dto'
import OrderCard from '../order-list/OrderCard'
import { dateFormat } from '@/lib/util'
import Search from '../Search'
import Pagination from '../Pagination'
import OrderFilters from '../order-list/OrderFilters'

interface Props {
  orders: [string, Order[]][]
  currentPage: number
  totalPages: number
  query: string
}

export default function CompletedOrders({ orders, currentPage, totalPages, query }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(debounce.current), [])

  // Search runs on the server so it covers every page, not just the one loaded
  function handleSearch(value: string) {
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value.trim()) params.set('q', value.trim())
      else params.delete('q')
      params.delete('page')
      router.replace(`${pathname}?${params.toString()}`)
    }, 300)
  }

  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <OrderFilters />
        <Search onSearch={handleSearch} defaultValue={query} placeholder="Search by order #" />
      </div>

      <div className="flex-1">
        {orders.length === 0 ? (
          <p className="text-sm text-ink-light">No completed orders found.</p>
        ) : (
          <div className="flex flex-col gap-10">
            {orders.map(([date, list]) => (
              <div key={date} className="flex flex-col gap-4">
                <h2 className="text-xs font-medium uppercase tracking-widest text-ink-light">
                  {dateFormat(date)}
                </h2>
                <Grid className="w-full">
                  <>
                    {list.map((order) => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </>
                </Grid>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto pt-4">
        <Pagination currentPage={currentPage} totalPages={totalPages} />
      </div>
    </div>
  )
}
