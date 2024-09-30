import { Order, OrderItem } from '@/lib/dto'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

const initialState: Order = {
  id: 0,
  status: '',
  items: [],
  created_at: '',
}

const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    setOrder: (_, action: PayloadAction<Order>) => {
      return { ...action.payload }
    },
    addItem: (state, action: PayloadAction<OrderItem>) => {
      action.payload.quantity = 1
      state.items = [...state.items, action.payload]
    },
    removeItem: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter((item) => item.id !== action.payload)
    },
    changeItemQuantity: (
      state,
      action: PayloadAction<{ itemId: number; quantity: number }>
    ) => {
      const item = state.items.find((item) => item.id === action.payload.itemId)
      if (!item) return
      if (action.payload.quantity < 1) {
        state.items = state.items.filter(
          (item) => item.id !== action.payload.itemId
        )
      } else {
        item.quantity = action.payload.quantity
      }
    },
  },
})

export const { setOrder, addItem, removeItem, changeItemQuantity } =
  orderSlice.actions
export default orderSlice.reducer
