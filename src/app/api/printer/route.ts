import sendToThermalPrinter from '@/lib/printer'
import { findOrder, parseOrderId } from '@/lib/prisma/operations'
import { exampleOrder, renderReceiptPreview } from '@/lib/receipt-preview'

// For testing the receipt:
//   { "orderId": 12 }                    print order 12 on the USB printer
//   { "orderId": 12, "preview": true }   PNG of what order 12's receipt looks like
//   { "example": true }                  PNG of a sample receipt, no database needed
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const orderId = parseOrderId(body.orderId)
  const order = body.example ? exampleOrder() : orderId ? await findOrder(orderId) : null
  if (!order) return new Response('Order not found', { status: 404 })

  if (body.example || body.preview) {
    const png = await renderReceiptPreview(order)
    return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } })
  }

  await sendToThermalPrinter(order)
  return new Response('OK')
}
