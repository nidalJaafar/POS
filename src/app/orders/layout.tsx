import OrdersNavigation from '@/components/orders-navigation/OrdersNavigation'
import React from 'react'

export default function layout({ children }: { children: React.ReactElement }) {
  return (
    <div className="flex flex-col gap-8">
      <OrdersNavigation />
      <div>{children}</div>
    </div>
  )
}
