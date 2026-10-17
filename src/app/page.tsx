import { getItems } from '@/lib/prisma/operations'
import { ItemsProvider } from '@/lib/context/ItemsContext'
import NewOrderGallery from '@/components/order-list/NewOrderGallery'

export const dynamic = 'force-dynamic'

export default async function page() {
  const items = await getItems()
  return (
    <ItemsProvider items={items}>
      <NewOrderGallery />
    </ItemsProvider>
  )
}
