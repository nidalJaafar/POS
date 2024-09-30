import { Item } from '@/lib/dto'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

const initialState: Item[] = []

const itemsSlice = createSlice({
  name: 'items',
  initialState,
  reducers: {
    setItems: (_, action: PayloadAction<Item[]>) => {
      return action.payload
    },
    addItem: (state, action: PayloadAction<Item>) => {
      return [...state, action.payload]
    },
    addItemToMenu: (state, action: PayloadAction<number>) => {
      return state.map((item) => {
        if (item.id === action.payload) {
          return { ...item, deleted: false }
        }
        return item
      })
    },
    removeItemFromMenu: (state, action: PayloadAction<number>) => {
      return state.map((item) => {
        if (item.id === action.payload) {
          return { ...item, deleted: true }
        }
        return item
      })
    },
  },
})

export const { setItems, addItem, removeItemFromMenu, addItemToMenu } =
  itemsSlice.actions
export default itemsSlice.reducer
