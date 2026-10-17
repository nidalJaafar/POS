'use client'

import { Order } from '@/lib/dto'
import 'chart.js/auto'
import { applyChartTheme, themeColor } from '@/lib/theme-colors'
import { Line } from 'react-chartjs-2'

interface Params {
  labels: string[]
  yearMap: [number, [number, Order[]][]][]
}


export default function LineChart({ labels, yearMap }: Params) {
  applyChartTheme()
  // The two most recent years alternate between the theme's text and primary colors
  const colors = [themeColor('chart'), themeColor('primary')]
  const yearMonthOrder: {
    label: string
    data: number[]
    backgroundColor: string
    borderColor: string
  }[] = []
  const sortedYearsMap = new Map<number, Map<number, Order[]>>()
  const convertedYearMap = new Map<number, Map<number, Order[]>>(
    yearMap.map(([year, monthArray]) => [year, new Map(monthArray)])
  )
  Array.from(convertedYearMap.keys())
    .sort((a, b) => b - a)
    .slice(0, 2)
    .forEach((year) => sortedYearsMap.set(year, convertedYearMap.get(year)!))
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
      className="max-h-[75vh]"
      options={options}
      data={{
        labels,
        datasets: yearMonthOrder,
      }}
    />
  )
}
