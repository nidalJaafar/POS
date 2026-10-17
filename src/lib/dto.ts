export interface Item {
  id: number
  name: string
  image: string
  price: number
  deleted: boolean
  created_at: string
}

export interface OrderItem extends Item {
  quantity: number
}

export interface Order {
  id: number
  items: OrderItem[]
  status: 'pending' | 'completed'
  created_at: string
}
