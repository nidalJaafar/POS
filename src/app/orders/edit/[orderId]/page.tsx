import EditPage from '@/components/order/EditPage'
import { getItems } from '@/lib/supabase/supabase-operations'

export default async function page() {
  const items = await getItems()
  return <EditPage items={items} />
}
