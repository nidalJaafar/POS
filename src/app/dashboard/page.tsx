import { BarChart } from '@/components/dashboard/BarChart'
import LineChart from '@/components/dashboard/LineChart'
import StackedBarChart from '@/components/dashboard/StackedBarChart'
import { getCompletedOrdersArray, getItems } from '@/lib/prisma/operations'
import { buildYearMap, currencyFormat, orderTotal } from '@/lib/util'
import { Order } from '@/lib/dto'

export const dynamic = 'force-dynamic'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function getThisMonthOrders(orders: Order[]): Order[] {
  const now = new Date()
  return orders.filter((o) => {
    const d = new Date(o.created_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
}

function getTopItem(orders: Order[]): string {
  const counts = new Map<string, number>()
  orders.forEach((o) =>
    o.items.forEach((item) => {
      counts.set(item.name, (counts.get(item.name) ?? 0) + item.quantity)
    })
  )
  if (counts.size === 0) return '—'
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0]
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface p-6 shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-light">{label}</span>
      <span className="text-2xl font-semibold text-ink">{value}</span>
    </div>
  )
}

export default async function page() {
  const [orders, items] = await Promise.all([getCompletedOrdersArray(), getItems()])
  const yearMap = buildYearMap(orders)

  const thisMonth = getThisMonthOrders(orders)
  const monthlyRevenue = thisMonth.reduce((sum, o) => sum + orderTotal(o.items), 0)
  const topItem = getTopItem(thisMonth)

  return (
    <div className="flex flex-col gap-10 sm:max-w-[80vw]">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard label="Total completed orders" value={String(orders.length)} />
        <StatCard label="Revenue this month" value={currencyFormat(monthlyRevenue)} />
        <StatCard label="Top item this month" value={topItem} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <h2 className="w-full text-base font-semibold">Top Orders Per Month</h2>
        <BarChart labels={MONTHS} items={items} yearMap={yearMap} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <h2 className="w-full text-base font-semibold">Annual Sales</h2>
        <LineChart labels={MONTHS} yearMap={yearMap} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <h2 className="w-full text-base font-semibold">Items Sold and Revenue Per Month</h2>
        <StackedBarChart labels={MONTHS} yearMap={yearMap} />
      </div>
    </div>
  )
}
