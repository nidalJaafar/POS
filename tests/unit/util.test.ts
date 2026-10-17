import { describe, expect, it } from 'vitest'
import { buildYearMap, currencyFormat, dateFormat, orderTotal } from '@/lib/util'
import { Order, OrderItem } from '@/lib/dto'

function line(price: number, quantity: number, id = 1): OrderItem {
  return { id, name: `Item ${id}`, image: '', price, quantity, deleted: false, created_at: '' }
}

function order(id: number, createdAt: Date): Order {
  return { id, status: 'completed', created_at: createdAt.toISOString(), items: [] }
}

describe('currencyFormat', () => {
  it('formats with two decimals and a dollar sign', () => {
    expect(currencyFormat(5)).toBe('$5.00')
    expect(currencyFormat(12.5)).toBe('$12.50')
  })

  it('adds thousands separators', () => {
    expect(currencyFormat(1234567.891)).toBe('$1,234,567.89')
  })

  it('returns an empty string for NaN', () => {
    expect(currencyFormat(NaN)).toBe('')
  })
})

describe('dateFormat', () => {
  it('formats a full timestamp in local time', () => {
    expect(dateFormat(new Date(2026, 9, 17, 15, 30).toISOString())).toBe('Saturday, October 17, 2026')
  })

  it('treats a bare YYYY-MM-DD as that local calendar day', () => {
    expect(dateFormat('2026-01-05')).toBe('Monday, January 05, 2026')
  })
})

describe('orderTotal', () => {
  it('sums price times quantity', () => {
    expect(orderTotal([line(2.5, 2), line(10, 3, 2)])).toBe(35)
  })

  it('is zero for an empty order', () => {
    expect(orderTotal([])).toBe(0)
  })
})

describe('buildYearMap', () => {
  it('groups orders by year and month with all 12 months present', () => {
    const orders = [
      order(1, new Date(2025, 0, 10)),
      order(2, new Date(2025, 0, 20)),
      order(3, new Date(2026, 5, 1)),
    ]
    const map = new Map(buildYearMap(orders).map(([year, months]) => [year, new Map(months)]))

    expect([...map.keys()].sort()).toEqual([2025, 2026])
    expect(map.get(2025)!.size).toBe(12)
    expect(map.get(2025)!.get(0)!.map((o) => o.id)).toEqual([1, 2])
    expect(map.get(2025)!.get(1)).toEqual([])
    expect(map.get(2026)!.get(5)!.map((o) => o.id)).toEqual([3])
  })
})
