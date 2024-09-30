'use client'
import useHorizontalScroll from '@/hooks/useHorizontalScroll'
import { Item, Order } from '@/lib/dto'
import 'chart.js/auto'
import React from 'react'
import { Bar } from 'react-chartjs-2'

interface Params {
  items: Item[]
  labels: string[]
  yearMap: Map<number, Map<number, Order[]>>
}

export function BarChart({ items, yearMap, labels }: Params) {
  const ref = useHorizontalScroll()
  const itemMap = new Map<number, Item>()
  items.forEach((item) => {
    itemMap.set(item.id, item)
  })

  const years: number[] = []

  yearMap.forEach((_, key) => {
    years.push(key)
  })

  const orderMap = yearMap.get(Math.max.apply(Math, years))
  if (!orderMap) return null

  const charts: React.ReactElement[] = []

  orderMap.forEach((orders, month) => {
    const orderItemsMap = new Map<number, number>()
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!orderItemsMap.has(item.id)) {
          orderItemsMap.set(item.id, 0)
        }
        orderItemsMap.set(item.id, orderItemsMap.get(item.id)! + item.quantity)
      })
    })
    const mapArray = Array.from(orderItemsMap.entries())
    if (mapArray.length < 3) return

    const sortedArray = mapArray
      .filter((a) => a[1] !== 0)
      .sort((a, b) => b[1] - a[1])
      .splice(0, 3)

    charts.push(
      <Bar
        key={month}
        className="h-[40vh] w-[50vw] sm:w-[20vw]"
        options={{
          maintainAspectRatio: false,
          responsive: true,
          plugins: {
            legend: {
              display: false,
            },
            title: {
              display: true,
              text: `Top orders for ${labels[month]}`,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        }}
        data={{
          labels: sortedArray.map((item) => itemMap.get(item[0])?.name),
          datasets: [
            {
              label: labels[month],
              data: sortedArray.map((item) => item[1]),
              grouped: true,
              maxBarThickness: 100,
              barPercentage: 1,
              categoryPercentage: 1,
              borderWidth: 1,
              borderColor: '#333333',
              backgroundColor: '#F7C15B',
            },
          ],
        }}
      />
    )
  })

  return (
    <div className="no-scrollbar flex gap-10 overflow-x-scroll" ref={ref}>
      {...charts}
    </div>
  )
}
