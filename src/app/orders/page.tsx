import PendingOrders from '@/components/order/PendingOrders'
import { getPendingOrders } from '@/lib/prisma/operations'

interface Props {
  searchParams: { page?: string; period?: string; sort?: string; from?: string; to?: string }
}

export default async function page({ searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page) || 1)
  const { orders, total } = await getPendingOrders(page, {
    period: searchParams.period,
    sort: searchParams.sort,
    from: searchParams.from,
    to: searchParams.to,
  })
  const totalPages = Math.ceil(total / 24)

  return <PendingOrders orders={orders} currentPage={page} totalPages={totalPages} />
}
