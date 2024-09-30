import CompletedOrders from '@/components/order/CompletedOrders'
import { getCompletedOrders } from '@/lib/supabase/supabase-operations'

export default async function page() {
  const orders = await getCompletedOrders()

  return <CompletedOrders orders={orders} />
}
