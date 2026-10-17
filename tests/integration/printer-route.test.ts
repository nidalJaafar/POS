import sharp from 'sharp'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendToThermalPrinter } = vi.hoisted(() => ({ sendToThermalPrinter: vi.fn(async (_order: unknown) => {}) }))
vi.mock('@/lib/printer', () => ({ default: sendToThermalPrinter }))

const { POST } = await import('@/app/api/printer/route')
const { createItem, createOrder, prisma, resetDatabase } = await import('../helpers/db')

function post(body: unknown) {
  return POST(new Request('http://localhost/api/printer', { method: 'POST', body: JSON.stringify(body) }))
}

beforeEach(async () => {
  await resetDatabase()
  vi.clearAllMocks()
})
afterAll(() => prisma.$disconnect())

describe('POST /api/printer', () => {
  it('returns a PNG preview of the example receipt without printing', async () => {
    const response = await post({ example: true })
    expect(response.headers.get('content-type')).toBe('image/png')
    expect((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format).toBe('png')
    expect(sendToThermalPrinter).not.toHaveBeenCalled()
  })

  it('previews a stored order', async () => {
    const cup = await createItem({ name: 'Cup' })
    const order = await createOrder({ lines: [{ itemId: cup.id, quantity: 2, unitPrice: 3 }] })
    const response = await post({ orderId: order.id, preview: true })
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(sendToThermalPrinter).not.toHaveBeenCalled()
  })

  it('prints a stored order', async () => {
    const cup = await createItem({ name: 'Cup' })
    const order = await createOrder({ lines: [{ itemId: cup.id, quantity: 2, unitPrice: 3 }] })
    const response = await post({ orderId: order.id })
    expect(await response.text()).toBe('OK')
    expect(sendToThermalPrinter).toHaveBeenCalledWith(expect.objectContaining({ id: order.id }))
  })
})
