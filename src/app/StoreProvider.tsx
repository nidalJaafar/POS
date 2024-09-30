'use client'
import { useRef } from 'react'
import { Provider } from 'react-redux'
import { Item, Order } from '@/lib/dto'
import { setItems } from '@/lib/store/item/itemSlice'
import { AppStore, makeStore } from '@/lib/store/store'
import { setOrder } from '@/lib/store/order/orderSlice'

interface Params {
  children: React.ReactNode
  items?: Item[]
  deletedItems?: Item[]
  order?: Order
}

export default function StoreProvider({ items, order, children }: Params) {
  const storeRef = useRef<AppStore>()
  if (!storeRef.current) {
    storeRef.current = makeStore()
    if (items) storeRef.current.dispatch(setItems(items))
    if (order) storeRef.current.dispatch(setOrder(order))
  }

  return <Provider store={storeRef.current}>{children}</Provider>
}
