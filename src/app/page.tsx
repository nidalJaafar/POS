import { getItems } from '@/lib/supabase/supabase-operations'
import StoreProvider from './StoreProvider'
import NewOrderGallery from '@/components/order-list/NewOrderGallery'

export const dynamic = 'force-dynamic'

async function page() {
  const items = await getItems()

  return (
    <StoreProvider items={items}>
      <NewOrderGallery />
    </StoreProvider>
  )
}

export default page
