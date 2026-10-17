import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  addOrder,
  changeOrderStatus,
  deleteOrder,
  findOrder,
  getCompletedOrders,
  getCompletedOrdersArray,
  getItems,
  getOrder,
  getPendingOrders,
  parseOrderId,
  updateDeletedItem,
  updateOrderItems,
  upsertItem,
} from '@/lib/prisma/operations'
import { OrderItem } from '@/lib/dto'
import { createItem, createOrder, prisma, resetDatabase } from '../helpers/db'

function cartLine(item: { id: number; name: string; price: number }, quantity: number): OrderItem {
  // The client sends price too, but the server must ignore it
  return { ...item, image: '', deleted: false, created_at: '', quantity, price: 0.01 }
}

function localDate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

describe('items', () => {
  it('lists items alphabetically, including deleted ones', async () => {
    await createItem({ name: 'Vase' })
    await createItem({ name: 'Bowl', deleted: true })
    await createItem({ name: 'Mug' })
    expect((await getItems()).map((i) => [i.name, i.deleted])).toEqual([
      ['Bowl', true],
      ['Mug', false],
      ['Vase', false],
    ])
  })

  it('creates a new item when no id is given', async () => {
    const saved = await upsertItem({ name: 'Cup', price: 5, image: '/uploads/c.jpg', deleted: false })
    expect(saved).toMatchObject({ name: 'Cup', price: 5, image: '/uploads/c.jpg', deleted: false })
    expect(await prisma.item.count()).toBe(1)
  })

  it('updates an existing item in place', async () => {
    const item = await createItem({ name: 'Cup', price: 5 })
    await upsertItem({ id: item.id, name: 'Big Cup', price: 7, image: item.image, deleted: false })
    const updated = await prisma.item.findUniqueOrThrow({ where: { id: item.id } })
    expect(updated).toMatchObject({ name: 'Big Cup', price: 7 })
    expect(await prisma.item.count()).toBe(1)
  })

  it('soft-deletes and restores items', async () => {
    const item = await createItem()
    await updateDeletedItem(item.id, true)
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).deleted).toBe(true)
    await updateDeletedItem(item.id, false)
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).deleted).toBe(false)
  })
})

describe('placing orders', () => {
  it('creates a pending order with the items and their current prices', async () => {
    const cup = await createItem({ name: 'Cup', price: 12.5 })
    const mug = await createItem({ name: 'Mug', price: 3 })

    await addOrder([cartLine(cup, 2), cartLine(mug, 1)], localDate())

    const [order] = await prisma.order.findMany({ include: { itemsOrders: true } })
    expect(order.status).toBe('pending')
    expect(order.itemsOrders.map((l) => [l.itemId, l.quantity, l.unitPrice]).sort()).toEqual(
      [[cup.id, 2, 12.5], [mug.id, 1, 3]].sort()
    )
  })

  it('stores the chosen day with the current time of day', async () => {
    const cup = await createItem()
    const timeOfDay = (d: Date) => ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds()
    const before = new Date()
    await addOrder([cartLine(cup, 1)], '2026-03-04')
    const after = new Date()
    const { createdAt } = await prisma.order.findFirstOrThrow()

    expect([createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()]).toEqual([2026, 2, 4])
    // Between the two clock readings (skipped in the rare run that crosses midnight)
    if (timeOfDay(after) >= timeOfDay(before)) {
      expect(timeOfDay(createdAt)).toBeGreaterThanOrEqual(timeOfDay(before))
      expect(timeOfDay(createdAt)).toBeLessThanOrEqual(timeOfDay(after))
    }
  })

  it('falls back to now for an invalid date', async () => {
    const cup = await createItem()
    const before = Date.now()
    await addOrder([cartLine(cup, 1)], 'not-a-date')
    const { createdAt } = await prisma.order.findFirstOrThrow()
    expect(createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000)
  })

  it.each([
    ['an empty cart', () => []],
    ['a zero quantity', (id: number) => [{ id, quantity: 0 }]],
    ['a fractional quantity', (id: number) => [{ id, quantity: 1.5 }]],
    ['the same item twice', (id: number) => [{ id, quantity: 1 }, { id, quantity: 2 }]],
    ['an unknown item', () => [{ id: 9999, quantity: 1 }]],
  ])('rejects %s and writes nothing', async (_label, lines) => {
    const cup = await createItem()
    const cart = (lines as (id: number) => { id: number; quantity: number }[])(cup.id).map((l) => ({
      ...cartLine(cup, l.quantity),
      id: l.id,
    }))
    await expect(addOrder(cart, localDate())).rejects.toThrow()
    expect(await prisma.order.count()).toBe(0)
  })
})

describe('price history', () => {
  it('changing an item price does not change past orders', async () => {
    const cup = await createItem({ price: 10 })
    await addOrder([cartLine(cup, 2)], localDate())
    const { id } = await prisma.order.findFirstOrThrow()

    await upsertItem({ id: cup.id, name: cup.name, image: cup.image, price: 99, deleted: false })

    const order = await getOrder(id)
    expect(order.items[0].price).toBe(10)
  })
})

describe('pending orders list', () => {
  it('paginates 24 per page and never repeats or skips orders that share a timestamp', async () => {
    const cup = await createItem()
    const sameMoment = new Date(2026, 4, 1, 12, 0, 0)
    for (let i = 0; i < 30; i++) {
      await createOrder({ createdAt: sameMoment, lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })
    }

    const page1 = await getPendingOrders(1)
    const page2 = await getPendingOrders(2)
    expect(page1.total).toBe(30)
    expect(page1.orders).toHaveLength(24)
    expect(page2.orders).toHaveLength(6)

    const ids = [...page1.orders, ...page2.orders].map((o) => o.id)
    expect(new Set(ids).size).toBe(30)
    expect(ids).toEqual([...ids].sort((a, b) => b - a))
  })

  it('sorts oldest first when asked', async () => {
    const cup = await createItem()
    const line = [{ itemId: cup.id, quantity: 1, unitPrice: 1 }]
    const older = await createOrder({ createdAt: new Date(2026, 0, 1), lines: line })
    const newer = await createOrder({ createdAt: new Date(2026, 5, 1), lines: line })

    expect((await getPendingOrders(1)).orders.map((o) => o.id)).toEqual([newer.id, older.id])
    expect((await getPendingOrders(1, { sort: 'asc' })).orders.map((o) => o.id)).toEqual([older.id, newer.id])
  })

  describe('period filters', () => {
    const now = new Date()
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

    it.each([
      ['today', now, daysAgo(2)],
      ['week', daysAgo(3), daysAgo(10)],
      ['month', new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 1), new Date(now.getFullYear(), now.getMonth(), 0, 12)],
      ['year', new Date(now.getFullYear(), 0, 1, 0, 0, 1), new Date(now.getFullYear() - 1, 11, 31, 12)],
    ])('"%s" includes orders inside the period only', async (period, inside, outside) => {
      const cup = await createItem()
      const line = [{ itemId: cup.id, quantity: 1, unitPrice: 1 }]
      const kept = await createOrder({ createdAt: inside as Date, lines: line })
      await createOrder({ createdAt: outside as Date, lines: line })

      const { orders } = await getPendingOrders(1, { period: period as string })
      expect(orders.map((o) => o.id)).toEqual([kept.id])
    })

    it('"all" includes everything', async () => {
      const cup = await createItem()
      const line = [{ itemId: cup.id, quantity: 1, unitPrice: 1 }]
      await createOrder({ createdAt: now, lines: line })
      await createOrder({ createdAt: new Date(2001, 0, 1), lines: line })
      expect((await getPendingOrders(1, { period: 'all' })).total).toBe(2)
    })
  })

  it('excludes completed orders', async () => {
    const cup = await createItem()
    await createOrder({ status: 'completed', lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })
    expect((await getPendingOrders(1)).total).toBe(0)
  })
})

describe('completing orders', () => {
  it('marks a pending order completed once', async () => {
    const cup = await createItem()
    const order = await createOrder({ lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })

    expect(await changeOrderStatus(order.id)).toBe(true)
    expect(await changeOrderStatus(order.id)).toBe(false)
    expect((await getOrder(order.id)).status).toBe('completed')
  })
})

describe('completed orders list', () => {
  it('groups orders by local calendar day', async () => {
    const cup = await createItem()
    const line = [{ itemId: cup.id, quantity: 1, unitPrice: 1 }]
    // 00:30 local time is still "yesterday" in UTC for zones east of UTC
    await createOrder({ status: 'completed', createdAt: new Date(2026, 6, 2, 0, 30), lines: line })
    await createOrder({ status: 'completed', createdAt: new Date(2026, 6, 2, 23, 0), lines: line })
    await createOrder({ status: 'completed', createdAt: new Date(2026, 6, 1, 12, 0), lines: line })

    const { orders } = await getCompletedOrders(1)
    expect(orders.map(([day, list]) => [day, list.length])).toEqual([
      ['2026-07-02', 2],
      ['2026-07-01', 1],
    ])
  })

  it('searches by order number across all pages', async () => {
    const cup = await createItem()
    const line = [{ itemId: cup.id, quantity: 1, unitPrice: 1 }]
    const created = []
    for (let i = 0; i < 70; i++) created.push(await createOrder({ status: 'completed', lines: line }))
    const oldest = created[0]

    const { orders, total } = await getCompletedOrders(1, { query: `#${oldest.id}` })
    expect(total).toBe(1)
    expect(orders.flatMap(([, list]) => list).map((o) => o.id)).toEqual([oldest.id])
  })

  describe('date picker range', () => {
    async function ordersOnDays() {
      const cup = await createItem()
      const line = [{ itemId: cup.id, quantity: 1, unitPrice: 1 }]
      const ids: Record<string, number> = {}
      for (const [key, date] of [
        ['mar1Early', new Date(2026, 2, 1, 0, 5)],
        ['mar1Late', new Date(2026, 2, 1, 23, 55)],
        ['mar2', new Date(2026, 2, 2, 12)],
        ['mar5', new Date(2026, 2, 5, 12)],
      ] as const) {
        ids[key] = (await createOrder({ status: 'completed', createdAt: date, lines: line })).id
      }
      return ids
    }
    const idsOf = (result: Awaited<ReturnType<typeof getCompletedOrders>>) =>
      result.orders.flatMap(([, list]) => list.map((o) => o.id)).sort((a, b) => a - b)

    it('a single day includes the whole local day', async () => {
      const ids = await ordersOnDays()
      expect(idsOf(await getCompletedOrders(1, { from: '2026-03-01' }))).toEqual([ids.mar1Early, ids.mar1Late])
      expect(idsOf(await getCompletedOrders(1, { to: '2026-03-01' }))).toEqual([ids.mar1Early, ids.mar1Late])
    })

    it('a range includes both end days', async () => {
      const ids = await ordersOnDays()
      expect(idsOf(await getCompletedOrders(1, { from: '2026-03-02', to: '2026-03-05' }))).toEqual([ids.mar2, ids.mar5])
    })

    it('a reversed range is swapped', async () => {
      const ids = await ordersOnDays()
      expect(idsOf(await getCompletedOrders(1, { from: '2026-03-05', to: '2026-03-02' }))).toEqual([ids.mar2, ids.mar5])
    })

    it('takes precedence over the period and combines with the order search', async () => {
      const ids = await ordersOnDays()
      expect(idsOf(await getCompletedOrders(1, { period: 'today', from: '2026-03-02' }))).toEqual([ids.mar2])
      expect((await getCompletedOrders(1, { from: '2026-03-01', query: String(ids.mar5) })).total).toBe(0)
    })

    it('ignores malformed dates', async () => {
      await ordersOnDays()
      expect((await getCompletedOrders(1, { from: 'yesterday' })).total).toBe(4)
    })

    it('works for pending orders too', async () => {
      const cup = await createItem()
      const line = [{ itemId: cup.id, quantity: 1, unitPrice: 1 }]
      const kept = await createOrder({ createdAt: new Date(2026, 6, 4, 10), lines: line })
      await createOrder({ createdAt: new Date(2026, 6, 5, 10), lines: line })
      expect((await getPendingOrders(1, { from: '2026-07-04' })).orders.map((o) => o.id)).toEqual([kept.id])
    })
  })

  it.each(['99999999999', '2147483648', '-5', '1.5'])('returns nothing (no error) for the impossible order number %s', async (q) => {
    const cup = await createItem()
    await createOrder({ status: 'completed', lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })
    expect((await getCompletedOrders(1, { query: q })).total).toBe(0)
  })

  it('returns nothing for a non-numeric search', async () => {
    const cup = await createItem()
    await createOrder({ status: 'completed', lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })
    expect((await getCompletedOrders(1, { query: 'abc' })).total).toBe(0)
  })

  it('paginates 60 per page', async () => {
    const cup = await createItem()
    const line = [{ itemId: cup.id, quantity: 1, unitPrice: 1 }]
    for (let i = 0; i < 65; i++) await createOrder({ status: 'completed', lines: line })
    const page2 = await getCompletedOrders(2)
    expect(page2.total).toBe(65)
    expect(page2.orders.flatMap(([, list]) => list)).toHaveLength(5)
  })

  it('getCompletedOrdersArray returns every completed order for the dashboard', async () => {
    const cup = await createItem()
    const line = [{ itemId: cup.id, quantity: 1, unitPrice: 1 }]
    for (let i = 0; i < 3; i++) await createOrder({ status: 'completed', lines: line })
    await createOrder({ status: 'pending', lines: line })
    expect(await getCompletedOrdersArray()).toHaveLength(3)
  })
})

describe('editing orders', () => {
  async function pendingOrderWithCup() {
    const cup = await createItem({ name: 'Cup', price: 10 })
    const mug = await createItem({ name: 'Mug', price: 4 })
    const order = await createOrder({ lines: [{ itemId: cup.id, quantity: 1, unitPrice: 10 }] })
    return { cup, mug, order: await getOrder(order.id) }
  }

  it('changes quantities, adds and removes items', async () => {
    const { cup, mug, order } = await pendingOrderWithCup()

    await updateOrderItems({ ...order, items: [{ ...order.items[0], quantity: 3 }, cartLine(mug, 2)] })
    let updated = await getOrder(order.id)
    expect(updated.items.map((i) => [i.name, i.quantity]).sort()).toEqual([['Cup', 3], ['Mug', 2]])

    await updateOrderItems({ ...updated, items: updated.items.filter((i) => i.id !== cup.id) })
    updated = await getOrder(order.id)
    expect(updated.items.map((i) => i.name)).toEqual(['Mug'])
  })

  it('keeps the original price on existing lines and uses the current price for new ones', async () => {
    const { cup, mug, order } = await pendingOrderWithCup()
    await prisma.item.update({ where: { id: cup.id }, data: { price: 50 } })
    await prisma.item.update({ where: { id: mug.id }, data: { price: 6 } })

    await updateOrderItems({ ...order, items: [{ ...order.items[0], quantity: 2 }, cartLine(mug, 1)] })
    const prices = Object.fromEntries((await getOrder(order.id)).items.map((i) => [i.name, i.price]))
    expect(prices).toEqual({ Cup: 10, Mug: 6 })
  })

  it('refuses to edit a completed order', async () => {
    const { order } = await pendingOrderWithCup()
    await changeOrderStatus(order.id)
    await expect(updateOrderItems({ ...order, items: [{ ...order.items[0], quantity: 5 }] })).rejects.toThrow(
      /Only pending orders/
    )
  })

  it('an edit started after the order was completed elsewhere waits, then refuses', async () => {
    const { Pool } = await import('pg')
    const { order } = await pendingOrderWithCup()
    const other = new Pool({ connectionString: process.env.DATABASE_URL })
    const client = await other.connect()
    try {
      // Another device completes the order but hasn't committed yet
      await client.query('BEGIN')
      await client.query(`UPDATE orders SET status = 'completed' WHERE id = $1`, [order.id])

      let settled = false
      const edit = updateOrderItems({ ...order, items: [{ ...order.items[0], quantity: 9 }] }).finally(() => {
        settled = true
      })
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(settled).toBe(false) // blocked on the row lock

      await client.query('COMMIT')
      await expect(edit).rejects.toThrow(/Only pending orders/)
      expect((await getOrder(order.id)).items[0].quantity).toBe(1)
    } finally {
      client.release()
      await other.end()
    }
  })

  it('refuses to save an order with no items', async () => {
    const { order } = await pendingOrderWithCup()
    await expect(updateOrderItems({ ...order, items: [] })).rejects.toThrow(/at least one item/)
    expect((await getOrder(order.id)).items).toHaveLength(1)
  })
})

describe('order ids from user input', () => {
  it.each([
    ['12', 12],
    [' #12 ', 12],
    ['2147483647', 2147483647],
    ['2147483648', null],
    ['0', null],
    ['-3', null],
    ['1.5', null],
    ['abc', null],
    ['', null],
  ])('parseOrderId(%j) is %j', (input, expected) => {
    expect(parseOrderId(input)).toBe(expected)
  })

  it('findOrder returns null for missing or impossible ids', async () => {
    expect(await findOrder(123)).toBeNull()
    expect(await findOrder(Number.NaN)).toBeNull()
    expect(await findOrder(99_999_999_999)).toBeNull()
  })
})

describe('deleting orders', () => {
  it('refuses to delete a completed order', async () => {
    const cup = await createItem()
    const order = await createOrder({ status: 'completed', lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })
    await expect(deleteOrder(order.id)).rejects.toThrow(/not a pending order/)
    expect(await prisma.order.count()).toBe(1)
    expect(await prisma.orderItem.count()).toBe(1)
  })

  it('removes the order and its lines', async () => {
    const cup = await createItem()
    const order = await createOrder({ lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })
    await deleteOrder(order.id)
    expect(await prisma.order.count()).toBe(0)
    expect(await prisma.orderItem.count()).toBe(0)
    await expect(getOrder(order.id)).rejects.toThrow(/not found/)
  })
})
