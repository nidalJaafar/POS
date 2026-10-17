import { prisma } from '@/lib/prisma'
import { Item, Order, OrderItem } from '../dto'
import { Prisma } from '@prisma/client'

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { itemsOrders: { include: { item: true } } }
}>

function toItem(item: {
  id: number
  name: string
  image: string
  price: number
  deleted: boolean
  createdAt: Date
}): Item {
  return {
    id: item.id,
    name: item.name,
    image: item.image,
    price: item.price,
    deleted: item.deleted,
    created_at: item.createdAt.toISOString(),
  }
}

function toOrder(order: OrderWithRelations): Order {
  return {
    id: order.id,
    status: order.status as 'pending' | 'completed',
    created_at: order.createdAt.toISOString(),
    items: order.itemsOrders.map((io) => ({
      ...toItem(io.item),
      price: io.unitPrice,
      quantity: io.quantity,
    })),
  }
}

// Group by the local calendar day (YYYY-MM-DD), not the UTC one
function localDateKey(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function mapOrdersByDate(orders: Order[]): [string, Order[]][] {
  const map = new Map<string, Order[]>()
  orders.forEach((order) => {
    const key = localDateKey(order.created_at)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(order)
  })
  return Array.from(map)
}

const orderInclude = {
  itemsOrders: { include: { item: true } },
} as const

export async function getItems(): Promise<Item[]> {
  const items = await prisma.item.findMany({ orderBy: { name: 'asc' } })
  return items.map(toItem)
}

export async function upsertItem(item: {
  image: string
  name: string
  price: number
  deleted: boolean
  id?: number
}): Promise<Item> {
  const { id, ...data } = item
  const saved = id
    ? await prisma.item.upsert({ where: { id }, update: data, create: data })
    : await prisma.item.create({ data })
  return toItem(saved)
}

const PENDING_PAGE_SIZE = 24
const COMPLETED_PAGE_SIZE = 60

export interface OrderFilters {
  period?: string
  sort?: string
  query?: string
  // Calendar days (YYYY-MM-DD, local time); they take precedence over period
  from?: string
  to?: string
}

function parseLocalDay(value?: string): Date | undefined {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
  if (!match) return undefined
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(day.getTime()) ? undefined : day
}

function dateRangeFor(filters: OrderFilters): { gte?: Date; lte?: Date } {
  const from = parseLocalDay(filters.from)
  const to = parseLocalDay(filters.to)
  if (!from && !to) return periodToDateRange(filters.period)

  // Only one day picked: show that day. Both picked in the wrong order: swap them.
  let [start, end] = [from ?? to!, to ?? from!]
  if (start > end) [start, end] = [end, start]
  const endOfDay = new Date(end)
  endOfDay.setHours(23, 59, 59, 999)
  return { gte: start, lte: endOfDay }
}

// Orders can share a created_at, so id breaks ties to keep pagination stable
function orderByFor(sort?: string): Prisma.OrderOrderByWithRelationInput[] {
  const dir = sort === 'asc' ? 'asc' : 'desc'
  return [{ createdAt: dir }, { id: dir }]
}

// Largest value of a Postgres INTEGER; anything bigger can't be an order id
const MAX_ORDER_ID = 2_147_483_647

/** A valid order id from user input (URL segment, search box), or null. */
export function parseOrderId(value?: string | number | null): number | null {
  const text = String(value ?? '').trim().replace(/^#/, '')
  if (!/^\d+$/.test(text)) return null
  const id = Number(text)
  return id > 0 && id <= MAX_ORDER_ID ? id : null
}

function orderIdFromQuery(query?: string): number | undefined {
  if (!query?.trim()) return undefined
  // An impossible id (text, too large) matches nothing instead of erroring
  return parseOrderId(query) ?? -1
}

function periodToDateRange(period?: string): { gte?: Date; lte?: Date } {
  const now = new Date()
  if (period === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    const end = new Date(now); end.setHours(23, 59, 59, 999)
    return { gte: start, lte: end }
  }
  if (period === 'week') {
    return { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  }
  if (period === 'month') {
    return { gte: new Date(now.getFullYear(), now.getMonth(), 1) }
  }
  if (period === 'year') {
    return { gte: new Date(now.getFullYear(), 0, 1) }
  }
  return {}
}

export async function getPendingOrders(
  page = 1,
  filters: OrderFilters = {}
): Promise<{ orders: Order[]; total: number }> {
  const dateRange = dateRangeFor(filters)
  const where = {
    status: 'pending',
    ...(dateRange.gte || dateRange.lte ? { createdAt: dateRange } : {}),
  }
  const orderBy = orderByFor(filters.sort)
  const [rows, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy, include: orderInclude, skip: (page - 1) * PENDING_PAGE_SIZE, take: PENDING_PAGE_SIZE }),
    prisma.order.count({ where }),
  ])
  return { orders: rows.map((o) => toOrder(o as OrderWithRelations)), total }
}

export async function getCompletedOrders(
  page = 1,
  filters: OrderFilters = {}
): Promise<{ orders: [string, Order[]][]; total: number }> {
  const dateRange = dateRangeFor(filters)
  const orderId = orderIdFromQuery(filters.query)
  const where = {
    status: 'completed',
    ...(dateRange.gte || dateRange.lte ? { createdAt: dateRange } : {}),
    ...(orderId !== undefined ? { id: orderId } : {}),
  }
  const orderBy = orderByFor(filters.sort)
  const [rows, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy, include: orderInclude, skip: (page - 1) * COMPLETED_PAGE_SIZE, take: COMPLETED_PAGE_SIZE }),
    prisma.order.count({ where }),
  ])
  return {
    orders: mapOrdersByDate(rows.map((o) => toOrder(o as OrderWithRelations))),
    total,
  }
}

export async function getCompletedOrdersArray(): Promise<Order[]> {
  const orders = await prisma.order.findMany({
    where: { status: 'completed' },
    orderBy: orderByFor('desc'),
    include: orderInclude,
  })
  return orders.map((o) => toOrder(o as OrderWithRelations))
}

export async function findOrder(orderId: number): Promise<Order | null> {
  if (parseOrderId(orderId) === null) return null
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  })
  return order ? toOrder(order as OrderWithRelations) : null
}

export async function getOrder(orderId: number): Promise<Order> {
  const order = await findOrder(orderId)
  if (!order) throw new Error(`Order ${orderId} not found`)
  return order
}

// The picker sends a local calendar date (YYYY-MM-DD). Keep the current time of day
// so orders placed on the same day still sort in the order they were placed.
function orderTimestamp(date: string): Date {
  const now = new Date()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return now
  const [, year, month, day] = match.map(Number)
  const timestamp = new Date(
    year, month - 1, day,
    now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()
  )
  return Number.isNaN(timestamp.getTime()) ? now : timestamp
}

function assertValidQuantities(items: { id: number; quantity: number }[]) {
  if (!items.length) throw new Error('An order needs at least one item')
  const ids = new Set<number>()
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error(`Invalid quantity for item ${item.id}`)
    }
    if (ids.has(item.id)) throw new Error(`Item ${item.id} appears twice in the order`)
    ids.add(item.id)
  }
}

// Prices always come from the database, never from the client
async function currentPrices(
  tx: Prisma.TransactionClient,
  itemIds: number[]
): Promise<Map<number, number>> {
  const rows = await tx.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, price: true } })
  const prices = new Map(rows.map((row) => [row.id, row.price]))
  for (const id of itemIds) {
    if (!prices.has(id)) throw new Error(`Item ${id} not found`)
  }
  return prices
}

export async function addOrder(items: OrderItem[], date: string): Promise<void> {
  assertValidQuantities(items)
  await prisma.$transaction(async (tx) => {
    const prices = await currentPrices(tx, items.map((item) => item.id))
    const order = await tx.order.create({
      data: { status: 'pending', createdAt: orderTimestamp(date) },
    })
    await tx.orderItem.createMany({
      data: items.map((item) => ({
        orderId: order.id,
        itemId: item.id,
        quantity: item.quantity,
        unitPrice: prices.get(item.id)!,
      })),
    })
  })
}

// Only pending orders can be deleted: a completed order has been paid for. A stale
// screen (or a second device) must not be able to remove it.
export async function deleteOrder(orderId: number): Promise<void> {
  // Order lines go with it (ON DELETE CASCADE)
  const { count } = await prisma.order.deleteMany({ where: { id: orderId, status: 'pending' } })
  if (count === 0) throw new Error(`Order ${orderId} is not a pending order`)
}

// Returns false when the order was already completed, so callers don't re-print it
export async function changeOrderStatus(orderId: number): Promise<boolean> {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: 'pending' },
    data: { status: 'completed' },
  })
  return count > 0
}

export async function updateOrderItems(updatedOrder: Order): Promise<void> {
  assertValidQuantities(updatedOrder.items)
  await prisma.$transaction(async (tx) => {
    // FOR UPDATE locks the order until this edit commits, so completing it at the same
    // moment waits instead of printing a receipt for lines that are about to change
    const [order] = await tx.$queryRaw<{ status: string }[]>`
      SELECT status FROM orders WHERE id = ${updatedOrder.id} FOR UPDATE`
    if (!order) throw new Error(`Order ${updatedOrder.id} not found`)
    if (order.status !== 'pending') throw new Error('Only pending orders can be edited')

    const existing = await tx.orderItem.findMany({
      where: { orderId: updatedOrder.id },
      select: { itemId: true, quantity: true },
    })
    const updatedMap = new Map(updatedOrder.items.map((item) => [item.id, item]))

    for (const e of existing) {
      const updated = updatedMap.get(e.itemId)
      if (!updated) {
        await tx.orderItem.deleteMany({ where: { orderId: updatedOrder.id, itemId: e.itemId } })
        continue
      }
      // Existing lines keep the price they were sold at
      if (updated.quantity !== e.quantity) {
        await tx.orderItem.updateMany({
          where: { orderId: updatedOrder.id, itemId: e.itemId },
          data: { quantity: updated.quantity },
        })
      }
      updatedMap.delete(e.itemId)
    }

    if (updatedMap.size === 0) return
    const prices = await currentPrices(tx, Array.from(updatedMap.keys()))
    await tx.orderItem.createMany({
      data: Array.from(updatedMap.values()).map((newItem) => ({
        orderId: updatedOrder.id,
        itemId: newItem.id,
        quantity: newItem.quantity,
        unitPrice: prices.get(newItem.id)!,
      })),
    })
  })
}

export async function updateDeletedItem(itemId: number, deleted: boolean): Promise<void> {
  await prisma.item.update({ where: { id: itemId }, data: { deleted } })
}
