import PendingOrders from '@/components/order/PendingOrders'
import { getPendingOrders } from '@/lib/supabase/supabase-operations'

export default async function page() {
  const orders = await getPendingOrders()

  return <PendingOrders orders={orders} />
}
