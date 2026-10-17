import { notFound, redirect } from 'next/navigation'
import EditPage from '@/components/order/EditPage'
import { findOrder, getItems, parseOrderId } from '@/lib/prisma/operations'
import { ItemsProvider } from '@/lib/context/ItemsContext'

interface Params {
  params: { orderId: string }
}

export default async function page({ params }: Params) {
  const orderId = parseOrderId(params.orderId)
  const [items, order] = await Promise.all([getItems(), orderId ? findOrder(orderId) : null])
  if (!order) notFound()
  // Completed orders can't be edited; show their details instead of a form that would fail
  if (order.status !== 'pending') redirect(`/orders/${order.id}`)
  return (
    <ItemsProvider items={items}>
      <EditPage order={order} />
    </ItemsProvider>
  )
}
