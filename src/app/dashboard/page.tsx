import { BarChart } from '@/components/dashboard/BarChart'
import LineChart from '@/components/dashboard/LineChart'
import StackedBarChart from '@/components/dashboard/StackedBarChart'
import { Order } from '@/lib/dto'
import {
  getCompletedOrders,
  getItems,
} from '@/lib/supabase/supabase-operations'

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export default async function page() {
  const orders = await getCompletedOrders()
  const items = await getItems()
  const yearMap = new Map<number, Map<number, Order[]>>()
  orders.forEach((order) => {
    const date = new Date(order.created_at ?? '')
    const year = date.getFullYear()
    const month = date.getMonth()
    if (!yearMap.has(year)) {
      yearMap.set(year, new Map())
      for (let i = 0; i < 12; i++) {
        yearMap.get(year)?.set(i, [])
      }
    }
    yearMap.get(year)?.get(month)?.push(order)
  })
  return (
    <div className="flex flex-col items-center justify-center gap-16">
      <div>
        <h1 className="text-xl font-bold">Top Orders Per Month</h1>
        <BarChart labels={months} items={items} yearMap={yearMap} />
      </div>
      <div className="flex max-h-[40vh] w-full flex-col items-center justify-center sm:max-h-[75vh]">
        <h1 className="text-xl font-bold">Annual Sales</h1>
        <LineChart labels={months} yearMap={yearMap} />
      </div>
      <div className="flex max-h-[40vh] w-full flex-col items-center justify-center sm:max-h-[75vh]">
        <h1 className="text-xl font-bold">Items Sold and Revenue Per Month</h1>
        <StackedBarChart labels={months} items={items} yearMap={yearMap} />
      </div>
    </div>
  )
}
