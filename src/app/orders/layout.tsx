import OrdersNavigation from '@/components/orders-navigation/OrdersNavigation'
import React from 'react'

export default function layout({ children }: { children: React.ReactElement }) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-center gap-10">
        <OrdersNavigation />
      </div>
      <div>{children}</div>
    </div>
  )
}
