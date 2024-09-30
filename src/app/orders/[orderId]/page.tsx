import OrderDetailsPage from '@/components/order/OrderDetailsPage'
import { getOrder } from '@/lib/supabase/supabase-operations'

interface Params {
  params: {
    orderId: string
  }
}

export default async function page({ params }: Params) {
  const order = await getOrder(Number(params.orderId))
  return <OrderDetailsPage order={order} />
}
