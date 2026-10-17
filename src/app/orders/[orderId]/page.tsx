import { notFound } from 'next/navigation'
import OrderDetailsPage from '@/components/order/OrderDetailsPage'
import { findOrder, parseOrderId } from '@/lib/prisma/operations'

interface Params {
  params: {
    orderId: string
  }
}

export default async function page({ params }: Params) {
  const orderId = parseOrderId(params.orderId)
  const order = orderId ? await findOrder(orderId) : null
  if (!order) notFound()
  return <OrderDetailsPage order={order} />
}
