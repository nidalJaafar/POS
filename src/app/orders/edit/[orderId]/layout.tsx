import StoreProvider from '@/app/StoreProvider'
import { getOrder } from '@/lib/supabase/supabase-operations'
import React from 'react'

interface Params {
  params: {
    orderId: string
  }
  children: React.ReactNode
}

export default async function layout({ params, children }: Params) {
  const order = await getOrder(Number(params.orderId))
  return <StoreProvider order={order}>{children}</StoreProvider>
}
