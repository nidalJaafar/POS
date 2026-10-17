'use client'
import useHorizontalScroll from '@/hooks/useHorizontalScroll'
import { Item, Order } from '@/lib/dto'
import React, { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import 'chart.js/auto'
import { applyChartTheme, themeColor } from '@/lib/theme-colors'

interface Params {
  items: Item[]
  labels: string[]
  yearMap: [number, [number, Order[]][]][]
}

function populateCharts(
  items: Item[],
  yearMap: Map<number, Map<number, Order[]>>,
  labels: string[]
) {
  const charts: React.JSX.Element[] = []
  const itemMap = new Map<number, Item>()
  items.forEach((item) => {
    itemMap.set(item.id, item)
  })

  const years: number[] = []

  yearMap.forEach((_, key) => {
    years.push(key)
  })

  const orderMap = yearMap.get(Math.max.apply(Math, years))
  if (!orderMap) return charts
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
    if (!mapArray.length) return charts

    const sortedArray = mapArray
      .filter((a) => a[1] !== 0)
      .sort((a, b) => b[1] - a[1])
      .splice(0, 3)

    charts.push(
      <Bar
        key={month}
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
              ticks: {
                stepSize: 1,
              },
            },
            x: {
              ticks: {
                autoSkip: false,
              },
            },
          },
        }}
        data={{
          labels: sortedArray.map((item) => itemMap.get(item[0])?.name),
          datasets: [
            {
              label: labels[month],
              data: sortedArray.map((item) => item[1]),
              borderWidth: 1,
              categoryPercentage: 1,
              barPercentage: 0.6,
              borderColor: themeColor('chart'),
              backgroundColor: themeColor('primary'),
            },
          ],
        }}
      />
    )
  })
  return charts
}

export function BarChart({ items, yearMap, labels }: Params) {
  const ref = useHorizontalScroll()
  applyChartTheme()
  const convertedYearMap = new Map<number, Map<number, Order[]>>(
    yearMap.map(([year, monthArray]) => [year, new Map(monthArray)])
  )
  const charts = populateCharts(items, convertedYearMap, labels)
  return (
    <div className="flex h-full w-full overflow-x-scroll" ref={ref}>
      {charts.map((chart, index) => (
        <div className="mx-10 w-full sm:h-[50vh] sm:w-[20vw]" key={index}>
          {chart}
        </div>
      ))}
    </div>
  )
}
