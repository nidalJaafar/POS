import path from 'path'
import { Order } from './dto'
import { currencyFormat } from '@/lib/util'

const escpos = require('escpos')

const INSTAGRAM_URL = 'https://www.instagram.com/sunflowercrafts1?igsh=MTR3c3lwdGp0amxibA=='
const LOGO_PATH = path.join(process.cwd(), 'public', 'logo-printer.png')

export interface ReceiptAdapter {
  write(data: Buffer, callback?: (error?: Error | null) => void): void
  close(callback?: (error?: Error | null) => void): void
}

// ESC p 0 25 250: kick the cash drawer on pin 2. escpos' own cashdraw() writes this as a
// UTF-8 string, which turns 0xFA into two bytes and prints a stray character on the receipt.
const OPEN_CASH_DRAWER = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa])

export function openCashDrawer(printer: any) {
  printer.buffer.write(OPEN_CASH_DRAWER)
}

// GS V 66 n: feed until the last printed line clears the cutter, plus n dots (24 ≈ 3 mm),
// then partial cut. escpos' cut() adds 3 blank lines on top of any feed and, given any
// argument, sends a partial cut anyway — so this keeps the same cut with far less paper.
const FEED_AND_CUT = Buffer.from([0x1d, 0x56, 0x42, 24])

export function feedAndCut(printer: any) {
  printer.buffer.write(FEED_AND_CUT)
}

export function createPrinter(adapter: ReceiptAdapter) {
  return new escpos.Printer(adapter, { encoding: 'GB18030' })
}

function loadLogo(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    escpos.Image.load(LOGO_PATH, (image: unknown) => (image instanceof Error ? reject(image) : resolve(image)))
  })
}

/**
 * Writes the receipt for an order into the printer's buffer. Shared by the USB
 * printer and the on-screen preview so both always show the same layout.
 */
export async function writeReceipt(printer: any, order: Order): Promise<void> {
  const logo = await loadLogo()

  // Print the logo image
  printer.align('ct')
  // Normal text size (GS ! 0); the old size(0.5, 0.5) sent an out-of-spec value
  printer.size(0, 0)
  await printer.image(logo, 'd24')
  // Print the Thank You message
  printer.text('Thank You For Your Order')
  printer.drawLine()

  // Print order number
  printer.text(`Order Number: #${order.id}`)
  printer.drawLine()

  let finalPrice = 0

  // Print order items
  order.items.forEach((item) => {
    finalPrice += item.quantity * item.price
    printer.tableCustom([
      { text: item.name, align: 'LEFT', width: 0.5 },
      { text: `x ${item.quantity}`, align: 'CENTER', width: 0.25 },
      { text: currencyFormat(item.price), align: 'RIGHT', width: 0.25 },
    ])
  })

  // Print total price
  printer.drawLine()
  printer.text(`Total ${currencyFormat(finalPrice)}`)
  printer.drawLine()

  // Additional line with currency info
  printer.text(`${currencyFormat(1)} = 90,000 L.L.`)
  printer.drawLine()

  // Print social media info
  printer.text('Follow Us on Instagram')
  printer.newLine()

  // Print QR code
  await new Promise<void>((resolve, reject) => {
    printer.qrimage(INSTAGRAM_URL, { type: 'png', mode: 'normal' }, (error: Error | null) =>
      error ? reject(error) : resolve()
    )
  })

  openCashDrawer(printer)
  printer.beep(1, 1)
  feedAndCut(printer)
}
