'use client'
import { Item, Order } from '@/lib/dto'
import { currencyFormat } from '@/lib/util'
import 'chart.js/auto'
import { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'

interface Params {
  items: Item[]
  yearMap: Map<number, Map<number, Order[]>>
  labels: string[]
}

export default function StackedBarChart({ items, yearMap, labels }: Params) {
  const [ChartComponent, setChartComponent] = useState<any>(null)

  useEffect(() => {
    async function loadChart() {
      const { Chart: ChartJS } = await import('chart.js')
      const zoomPlugin = await import('chartjs-plugin-zoom')

      ChartJS.register(zoomPlugin.default)
      setChartComponent(() => Bar)
    }

    loadChart()
  }, [])
  if (!ChartComponent) return null
  const year = Array.from(yearMap.keys()).sort((a, b) => b - a)[0]

  // Create datasets for quantity sold and revenue
  const quantityDatasets = items.map((item) => {
    const data = labels.map((_, index) => {
      const ordersPerMonth = yearMap.get(year)?.get(index) || []
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
      const ordersPerMonth = yearMap.get(year)?.get(index) || []
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
    <ChartComponent
      data={{
        labels: labels, // Array of month labels
        datasets: [...quantityDatasets, ...revenueDatasets], // Merge both quantity and revenue datasets
      }}
      options={{
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          zoom: {
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
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
                // Display month names
                const monthIndex = tooltipItems[0].dataIndex
                return labels[monthIndex]
              },
              label: (tooltipItem: {
                dataset: { label: string }
                raw: any
              }) => {
                const datasetLabel: string = tooltipItem.dataset.label
                const value = tooltipItem.raw
                return `${datasetLabel}: ${datasetLabel.includes('Revenue') ? currencyFormat(value) : value}`
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
            stacked: true, // Enable stacking on the x-axis
          },
          Quantity: {
            type: 'linear',
            position: 'left',
            ticks: {
              beginAtZero: true,
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
              beginAtZero: true,
              color: '#F7C15B',
            },
            title: {
              display: true,
              text: 'Revenue',
            },
            stacked: true, // Enable stacking on the y-axis
          },
        },
      }}
    />
  )
}
