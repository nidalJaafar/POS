'use client'
import { Order } from '@/lib/dto'
import 'chart.js/auto'
import { applyChartTheme, themeColor } from '@/lib/theme-colors'
import { Chart } from 'react-chartjs-2'

interface Params {
  yearMap: [number, [number, Order[]][]][]
  labels: string[]
}

export default function StackedBarChart({ yearMap, labels }: Params) {
  applyChartTheme()
  const convertedYearMap = new Map(
    yearMap.map(([year, monthArray]) => [year, new Map(monthArray)])
  )
  const year = Array.from(convertedYearMap.keys()).sort((a, b) => b - a)[0]
  const monthMap = convertedYearMap.get(year)

  const quantityData = labels.map((_, i) => {
    const orders = monthMap?.get(i) ?? []
    return orders.reduce((sum, o) => sum + o.items.reduce((s, item) => s + item.quantity, 0), 0)
  })

  const revenueData = labels.map((_, i) => {
    const orders = monthMap?.get(i) ?? []
    return orders.reduce(
      (sum, o) => sum + o.items.reduce((s, item) => s + item.quantity * item.price, 0),
      0
    )
  })

  return (
    <Chart type="bar"
      className="max-h-[60vh]"
      data={{
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Units Sold',
            data: quantityData,
            backgroundColor: themeColor('chart'),
            borderRadius: 6,
            yAxisID: 'quantity',
          },
          {
            type: 'line',
            label: 'Revenue ($)',
            data: revenueData,
            borderColor: themeColor('primary'),
            backgroundColor: themeColor('primary', 0.13),
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: themeColor('primary'),
            tension: 0.4,
            fill: true,
            yAxisID: 'revenue',
          },
        ],
      }}
      options={{
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: { display: true, position: 'top' as const },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.yAxisID === 'revenue') {
                  return ` Revenue: $${Number(ctx.raw).toFixed(2)}`
                }
                return ` Units: ${ctx.raw}`
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          quantity: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Units Sold', color: themeColor('chart') },
            ticks: { color: themeColor('chart') },
            grid: { color: themeColor('panel-dark', 0.4) },
            beginAtZero: true,
          },
          revenue: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Revenue ($)', color: themeColor('ink-light') },
            ticks: {
              color: themeColor('ink-light'),
              callback: (v) => `$${Number(v).toFixed(0)}`,
            },
            grid: { display: false },
            beginAtZero: true,
          },
        },
      }}
    />
  )
}
