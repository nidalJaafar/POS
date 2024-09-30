'use client'

import React, { useEffect } from 'react'
import 'chart.js/auto'
import { Line } from 'react-chartjs-2'
import { Order } from '@/lib/dto'

interface Params {
  labels: string[]
  yearMap: Map<number, Map<number, Order[]>>
}

const colors = ['#C7933D', '#F7C15B']

export default function LineChart({ labels, yearMap }: Params) {
  useEffect(() => {}, [])
  const yearMonthOrder: {
    label: string
    data: number[]
    backgroundColor: string
    borderColor: string
  }[] = []
  const sortedYearsMap = new Map<number, Map<number, Order[]>>()
  Array.from(yearMap.keys())
    .sort((a, b) => b - a)
    .slice(0, 2)
    .forEach((year) => sortedYearsMap.set(year, yearMap.get(year)!))
  sortedYearsMap.forEach((monthMap, year) => {
    const initialValue = new Array(12).fill(0)
    monthMap.forEach((orders, month) => {
      initialValue[month] = orders.length
    })
    yearMonthOrder.push({
      label: `${year}`,
      data: initialValue,
      borderColor: colors[year % 2],
      backgroundColor: colors[year % 2],
    })
  })
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: yearMonthOrder.length > 1,
        position: 'top' as const,
      },
      title: {
        display: false,
        text: 'Sales per month',
      },
    },
  }
  return (
    <Line
      options={options}
      data={{
        labels,
        datasets: yearMonthOrder,
      }}
    />
  )
}
