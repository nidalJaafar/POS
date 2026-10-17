import CompletedOrders from '@/components/order/CompletedOrders'
import { getCompletedOrders } from '@/lib/prisma/operations'

interface Props {
  searchParams: { page?: string; period?: string; sort?: string; q?: string; from?: string; to?: string }
}

export default async function page({ searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page) || 1)
  const { orders, total } = await getCompletedOrders(page, {
    period: searchParams.period,
    sort: searchParams.sort,
    from: searchParams.from,
    to: searchParams.to,
    query: searchParams.q,
  })
  const totalPages = Math.ceil(total / 60)

  return (
    <CompletedOrders
      orders={orders}
      currentPage={page}
      totalPages={totalPages}
      query={searchParams.q ?? ''}
    />
  )
}
