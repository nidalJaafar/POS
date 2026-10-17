import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { captureReceipt, exampleOrder, interpretEscPos, renderReceiptPreview } from '@/lib/receipt-preview'

function texts(bytes: Buffer) {
  return interpretEscPos(bytes)
    .ops.filter((op) => op.kind === 'text')
    .map((op) => (op as { text: string }).text.trim())
}

describe('receipt content', () => {
  it('lists every item with quantity and price, and the total', async () => {
    const lines = texts(await captureReceipt(exampleOrder()))
    expect(lines).toContain('Thank You For Your Order')
    expect(lines).toContain('Order Number: #1042')
    expect(lines.find((l) => l.startsWith('Sunflower Mug'))).toMatch(/Sunflower Mug\s+x 2\s+\$12\.50$/)
    expect(lines).toContain('Total $76.75')
    expect(lines).toContain('Follow Us on Instagram')
  })

  it('prints the logo and the QR code as images', async () => {
    const { ops } = interpretEscPos(await captureReceipt(exampleOrder()))
    const bitmaps = ops.filter((op) => op.kind === 'bitmap')
    // Logo bands (ESC *) plus one raster QR code (GS v 0)
    expect(bitmaps.length).toBeGreaterThan(2)
    for (const op of bitmaps) expect((op as { width: number }).width).toBeLessThanOrEqual(576)
  })

  it('opens the drawer with the exact ESC p bytes and leaves no stray characters', async () => {
    const bytes = await captureReceipt(exampleOrder())
    expect(bytes.includes(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]))).toBe(true)
    // 0xC3 0xBA is what the UTF-8-mangled drawer command used to look like
    expect(bytes.includes(Buffer.from([0x19, 0xc3, 0xba]))).toBe(false)
    const events = interpretEscPos(bytes).ops.filter((op) => op.kind === 'event').map((op) => (op as { label: string }).label)
    expect(events).toEqual(['cash drawer opens', 'beep', 'paper cut (partial)'])
  })

  it('cuts about 3 mm below the QR code instead of feeding blank lines', async () => {
    const bytes = await captureReceipt(exampleOrder())
    expect(bytes.subarray(-4)).toEqual(Buffer.from([0x1d, 0x56, 0x42, 24]))

    const { ops } = interpretEscPos(bytes)
    const cut = ops.find((op) => op.kind === 'event' && (op as { cut?: boolean }).cut)!
    const qr = ops.filter((op) => op.kind === 'bitmap').at(-1) as { y: number; height: number }
    expect(cut.y - (qr.y + qr.height)).toBe(24)
  })
})

describe('interpretEscPos', () => {
  it('centres text when alignment is centre', () => {
    const bytes = Buffer.concat([Buffer.from([0x1b, 0x61, 0x01]), Buffer.from('ABCD\n')])
    const [op] = interpretEscPos(bytes).ops as { x: number; text: string }[]
    expect(op).toMatchObject({ text: 'ABCD', x: (576 - 4 * 12) / 2 })
  })

  it('applies GS ! character size', () => {
    const bytes = Buffer.concat([Buffer.from([0x1d, 0x21, 0x11]), Buffer.from('X\n')])
    expect(interpretEscPos(bytes).ops[0]).toMatchObject({ scaleX: 2, scaleY: 2 })
  })
})

describe('renderReceiptPreview', () => {
  it('returns a PNG wide enough for 80 mm paper', async () => {
    const png = await renderReceiptPreview(exampleOrder())
    const meta = await sharp(png).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBeGreaterThan(640)
    expect(meta.height).toBeGreaterThan(800)
  })
})
