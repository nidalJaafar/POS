import sendToThermalPrinter from '@/lib/printer'
import { getOrder } from '@/lib/supabase/supabase-operations'

// this is for testing purposes only
export async function POST(req: Request) {
  const { orderId } = await req.json()
  const order = await getOrder(orderId)
  await sendToThermalPrinter(order)
  return new Response('OK')
}
