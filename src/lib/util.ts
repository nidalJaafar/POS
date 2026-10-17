import { Order, OrderItem } from './dto'

export function currencyFormat(num: number): string {
  if (isNaN(num)) {
    return ''
  }
  return '$' + num.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

export function dateFormat(date: string): string {
  // A bare YYYY-MM-DD is a local calendar day; new Date() would read it as UTC midnight
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const dateObj = dayOnly
    ? new Date(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3]))
    : new Date(date)

  const daysOfWeek = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]
  const monthsOfYear = [
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

  const dayOfWeek = daysOfWeek[dateObj.getDay()]
  const day = String(dateObj.getDate()).padStart(2, '0')
  const month = monthsOfYear[dateObj.getMonth()]
  const year = dateObj.getFullYear()

  return `${dayOfWeek}, ${month} ${day}, ${year}`
}

export function orderTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.price, 0)
}

export function buildYearMap(orders: Order[]): [number, [number, Order[]][]][] {
  const yearMap = new Map<number, Map<number, Order[]>>()
  orders.forEach((order) => {
    const date = new Date(order.created_at)
    const year = date.getFullYear()
    const month = date.getMonth()
    if (!yearMap.has(year)) {
      yearMap.set(year, new Map())
      for (let i = 0; i < 12; i++) yearMap.get(year)!.set(i, [])
    }
    yearMap.get(year)!.get(month)!.push(order)
  })
  return Array.from(yearMap.entries()).map(([year, monthMap]) => [
    year,
    Array.from(monthMap.entries()),
  ])
}
