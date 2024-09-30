import { configureStore } from '@reduxjs/toolkit'
import orderReducer from './order/orderSlice'
import itemsReducer from './item/itemSlice'

export function makeStore() {
  return configureStore({
    reducer: {
      order: orderReducer,
      items: itemsReducer,
    },
  })
}
export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
