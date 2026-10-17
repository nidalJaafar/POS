import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { redirect, revalidatePath, sendToThermalPrinter } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    // Like Next, redirect() stops the action by throwing
    throw Object.assign(new Error(`NEXT_REDIRECT ${url}`), { url })
  }),
  revalidatePath: vi.fn(),
  sendToThermalPrinter: vi.fn(async (_order: unknown) => {}),
}))

vi.mock('next/navigation', () => ({ redirect, RedirectType: { push: 'push', replace: 'replace' } }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/printer', () => ({ default: sendToThermalPrinter }))

const actions = await import('@/lib/actions')
const { createItem, createOrder, prisma, resetDatabase } = await import('../helpers/db')

async function pngFile(name = 'photo.png', size = 2400) {
  const buffer = await sharp({
    create: { width: size, height: size / 2, channels: 3, background: { r: 250, g: 190, b: 40 } },
  })
    .png()
    .toBuffer()
  return new File([buffer], name, { type: 'image/png' })
}

function itemForm(fields: Record<string, string | File>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return form
}

beforeEach(async () => {
  await resetDatabase()
  vi.clearAllMocks()
  delete process.env.PRINTER_VID
  delete process.env.PRINTER_PID
})
afterAll(() => prisma.$disconnect())

describe('placeOrder', () => {
  it('saves the order and redirects to the orders list', async () => {
    const cup = await createItem({ price: 8 })
    await expect(
      actions.placeOrder([{ ...cup, created_at: '', quantity: 2 }], '2026-10-17')
    ).rejects.toThrow('NEXT_REDIRECT /orders')

    const lines = await prisma.orderItem.findMany()
    expect(lines.map((l) => [l.quantity, l.unitPrice])).toEqual([[2, 8]])
    expect(revalidatePath).toHaveBeenCalledWith('/orders')
  })
})

describe('completePendingOrder', () => {
  it('completes the order, revalidates every view and goes to completed orders', async () => {
    const cup = await createItem()
    const order = await createOrder({ lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })

    await expect(actions.completePendingOrder(order.id)).rejects.toThrow('NEXT_REDIRECT /orders/completed')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('completed')
    for (const p of ['/orders', '/orders/completed', `/orders/${order.id}`, '/dashboard']) {
      expect(revalidatePath).toHaveBeenCalledWith(p)
    }
    expect(sendToThermalPrinter).not.toHaveBeenCalled()
  })

  it('prints a receipt when a printer is configured', async () => {
    process.env.PRINTER_VID = '0x1fc9'
    process.env.PRINTER_PID = '0x2016'
    const cup = await createItem({ name: 'Cup' })
    const order = await createOrder({ lines: [{ itemId: cup.id, quantity: 2, unitPrice: 5 }] })

    await expect(actions.completePendingOrder(order.id)).rejects.toThrow('NEXT_REDIRECT')
    expect(sendToThermalPrinter).toHaveBeenCalledTimes(1)
    expect(sendToThermalPrinter.mock.calls[0][0]).toMatchObject({
      id: order.id,
      items: [{ name: 'Cup', quantity: 2, price: 5 }],
    })
  })

  it('does not print twice when completed twice', async () => {
    process.env.PRINTER_VID = '1'
    process.env.PRINTER_PID = '2'
    const cup = await createItem()
    const order = await createOrder({ lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })

    await expect(actions.completePendingOrder(order.id)).rejects.toThrow('NEXT_REDIRECT')
    await expect(actions.completePendingOrder(order.id)).rejects.toThrow('NEXT_REDIRECT')
    expect(sendToThermalPrinter).toHaveBeenCalledTimes(1)
  })

  it('still completes and redirects when the printer fails', async () => {
    process.env.PRINTER_VID = '1'
    process.env.PRINTER_PID = '2'
    sendToThermalPrinter.mockRejectedValueOnce(new Error('Can not find printer'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cup = await createItem()
    const order = await createOrder({ lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })

    await expect(actions.completePendingOrder(order.id)).rejects.toThrow('NEXT_REDIRECT /orders/completed')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('completed')
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

describe('deletePendingOrder', () => {
  it('refuses to delete an order that was already completed', async () => {
    const cup = await createItem()
    const order = await createOrder({ status: 'completed', lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })
    await expect(actions.deletePendingOrder(order.id)).rejects.toThrow(/not a pending order/)
    expect(await prisma.order.count()).toBe(1)
  })

  it('deletes and redirects to the orders list', async () => {
    const cup = await createItem()
    const order = await createOrder({ lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })
    await expect(actions.deletePendingOrder(order.id)).rejects.toThrow('NEXT_REDIRECT /orders')
    expect(await prisma.order.count()).toBe(0)
  })
})

describe('updateOrderItemsAction', () => {
  it('saves the edit and returns to the order page', async () => {
    const cup = await createItem({ name: 'Cup' })
    const created = await createOrder({ lines: [{ itemId: cup.id, quantity: 1, unitPrice: 1 }] })
    const { getOrder } = await import('@/lib/prisma/operations')
    const order = await getOrder(created.id)

    await expect(
      actions.updateOrderItemsAction({ ...order, items: [{ ...order.items[0], quantity: 4 }] })
    ).rejects.toThrow(`NEXT_REDIRECT /orders/${order.id}`)
    expect((await prisma.orderItem.findFirstOrThrow()).quantity).toBe(4)
  })
})

describe('addItemToMenu', () => {
  it('stores a resized JPEG for an uploaded photo and creates the item', async () => {
    await actions.addItemToMenu(itemForm({ name: '  Sunflower Mug ', price: '12.5', image: await pngFile() }))

    const item = await prisma.item.findFirstOrThrow()
    expect(item).toMatchObject({ name: 'Sunflower Mug', price: 12.5, deleted: false })
    expect(item.image).toMatch(/^\/uploads\/[0-9a-f-]{36}\.jpg$/)

    const stored = path.join(process.env.UPLOADS_DIR!, path.basename(item.image))
    const meta = await sharp(fs.readFileSync(stored)).metadata()
    expect(meta.format).toBe('jpeg')
    expect(Math.max(meta.width!, meta.height!)).toBe(1200)
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('keeps the existing image when editing without a new photo', async () => {
    const item = await createItem({ name: 'Cup', price: 5, image: '/uploads/cup.jpg' })
    await actions.addItemToMenu(
      itemForm({ id: String(item.id), name: 'Cup XL', price: '6', image: '/uploads/cup.jpg' })
    )
    expect(await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({
      name: 'Cup XL',
      price: 6,
      image: '/uploads/cup.jpg',
    })
  })

  it('allows a price of zero', async () => {
    await actions.addItemToMenu(itemForm({ name: 'Free sticker', price: '0', image: '/uploads/s.jpg' }))
    expect((await prisma.item.findFirstOrThrow()).price).toBe(0)
  })

  it.each([
    ['a missing name', { name: '  ', price: '5', image: '/uploads/a.jpg' }, /Missing required fields/],
    ['a missing price', { name: 'Cup', price: '', image: '/uploads/a.jpg' }, /Missing required fields/],
    ['a missing image', { name: 'Cup', price: '5', image: '' }, /Missing required fields/],
    ['a negative price', { name: 'Cup', price: '-1', image: '/uploads/a.jpg' }, /zero or more/],
    ['a non-numeric price', { name: 'Cup', price: 'abc', image: '/uploads/a.jpg' }, /zero or more/],
  ])('rejects %s', async (_label, fields, error) => {
    await expect(actions.addItemToMenu(itemForm(fields))).rejects.toThrow(error)
    expect(await prisma.item.count()).toBe(0)
  })

  it('rejects a file that is not an image', async () => {
    const html = new File(['<script>alert(1)</script>'], 'evil.html', { type: 'text/html' })
    await expect(actions.addItemToMenu(itemForm({ name: 'Cup', price: '5', image: html }))).rejects.toThrow(
      /not a supported image/
    )
    expect(await prisma.item.count()).toBe(0)
  })
})

describe('updateIsDeleted', () => {
  it('toggles the deleted flag and refreshes the menu', async () => {
    const item = await createItem()
    await actions.updateIsDeleted(item.id, true)
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).deleted).toBe(true)
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })
})
