'use client'
import { Item, Order } from '@/lib/dto'
import 'chart.js/auto'
import { Bar } from 'react-chartjs-2'

interface Params {
  items: Item[]
  yearMap: [number, [number, Order[]][]][]
  labels: string[]
}

export default function StackedBarChart({ items, yearMap, labels }: Params) {
  const convertedYearMap = new Map<number, Map<number, Order[]>>(
    yearMap.map(([year, monthArray]) => [year, new Map(monthArray)])
  )
  const year = Array.from(convertedYearMap.keys()).sort((a, b) => b - a)[0]

  const quantityDatasets = items.map((item) => {
    const data = labels.map((_, index) => {
      const ordersPerMonth = convertedYearMap.get(year)?.get(index) || []
      return ordersPerMonth.reduce((total, order) => {
        const orderItem = order.items.find((i) => i.id === item.id)
        return total + (orderItem ? orderItem.quantity : 0)
      }, 0)
    })

    return {
      label: `${item.name} - Quantity Sold`,
      data,
      backgroundColor: '#C7933D',
      borderColor: '#333333',
      borderWidth: 1,
      borderSkipped: false,
      yAxisID: 'Quantity',
      stack: 'Stack 0',
    }
  })

  const revenueDatasets = items.map((item) => {
    const data = labels.map((_, index) => {
      const ordersPerMonth = convertedYearMap.get(year)?.get(index) || []
      return ordersPerMonth.reduce((total, order) => {
        const orderItem = order.items.find((i) => i.id === item.id)
        return total + (orderItem ? orderItem.quantity * item.price : 0)
      }, 0)
    })

    return {
      label: `${item.name} - Revenue`,
      data,
      backgroundColor: '#F7C15B',
      borderColor: '#333333',
      borderWidth: 1,
      borderSkipped: false,
      yAxisID: 'Revenue',
      stack: 'Stack 1',
    }
  })

  return (
    <Bar
      className="max-h-[75vh]"
      data={{
        labels: labels,
        datasets: [...quantityDatasets, ...revenueDatasets],
      }}
      options={{
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: {
            display: false,
          },
          title: {
            display: false,
            text: 'Items Sold and Revenue per Month',
          },
          tooltip: {
            callbacks: {
              title: (tooltipItems: { dataIndex: any }[]) => {
                const monthIndex = tooltipItems[0].dataIndex
                return labels[monthIndex]
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Month',
            },
            ticks: {
              autoSkip: false,
            },
            stacked: true,
          },
          Quantity: {
            type: 'linear',
            position: 'left',
            ticks: {
              color: '#C7933D',
            },
            title: {
              display: true,
              text: 'Quantity',
            },
          },
          Revenue: {
            type: 'linear',
            position: 'right',
            ticks: {
              color: '#F7C15B',
            },
            title: {
              display: true,
              text: 'Revenue',
            },
            stacked: true,
          },
        },
      }}
    />
  )
}
