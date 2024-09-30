import supabase from '@/lib/supabase/supabase'
import { Item, Order, OrderItem } from '../dto'

export async function getItems() {
  const { data: items, error } = await supabase
    .from('items')
    .select()
    .order('name', { ascending: true })
    .returns<Item[]>()
  if (error) throw Error('Error fetching items')
  return items
}

export async function upsertItem(item: {
  image: string
  name: string
  price: number
  deleted: boolean
  id?: number
}) {
  const { data: items, error } = await supabase
    .from('items')
    .upsert([item], { onConflict: 'id' })
    .select()

  if (error) {
    throw new Error(`Error upserting item: ${error.message}`)
  }

  return items
}

async function getOrdersQuery(status?: string, id?: number): Promise<Order[]> {
  let ordersQuery = supabase
    .from('orders')
    .select(
      'id,status,created_at,items_orders(items(id,name,image,price,deleted,created_at),quantity)'
    )
    .order('id', { ascending: true }) // Orders sorted by ID

  if (status) ordersQuery = ordersQuery.eq('status', status)
  if (id) ordersQuery = ordersQuery.eq('id', id)

  const { data, error } = await ordersQuery

  type OrdersQuery = {
    id: number
    status: string
    created_at: string
    items_orders: {
      items: {
        id: number
        name: string
        image: string
        deleted: boolean
        price: number
        created_at: string
      }
      quantity: number
    }[]
  }[]

  if (error) throw new Error('Error fetching items')

  const orders: OrdersQuery = data as unknown as OrdersQuery

  const mappedOrders: Order[] = orders.map((order) => ({
    id: order.id,
    status: order.status,
    created_at: order.created_at,
    items: order.items_orders
      .map((itemOrder) => ({
        id: itemOrder.items.id,
        name: itemOrder.items.name,
        image: itemOrder.items.image,
        price: itemOrder.items.price,
        deleted: itemOrder.items.deleted,
        created_at: itemOrder.items.created_at,
        quantity: itemOrder.quantity,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }))

  return mappedOrders
}

export async function getPendingOrders(): Promise<Order[]> {
  return getOrdersQuery('pending')
}

export async function getCompletedOrders(): Promise<Order[]> {
  return getOrdersQuery('completed')
}

export async function getOrder(orderId: number): Promise<Order> {
  return getOrdersQuery(undefined, orderId)
    .then((orders) => orders[0])
    .catch((error) => {
      throw error
    })
}

export async function addOrder(items: OrderItem[]) {
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({ status: 'pending' })
    .select()
    .single()

  if (orderError) {
    console.error('Error inserting order:', orderError)
    return
  }

  const orderId = orderData?.id

  if (!orderId) {
    console.error('Order ID is missing')
    return
  }

  const itemsOrders = items.map((item) => ({
    order_id: orderId,
    item_id: item.id,
    quantity: item.quantity,
  }))

  const { error: itemsOrdersError } = await supabase
    .from('items_orders')
    .insert(itemsOrders)

  if (itemsOrdersError) {
    console.error('Error inserting items_orders:', itemsOrdersError)
    return
  }
}

export async function deleteOrder(orderId: number) {
  await supabase.from('items_orders').delete().eq('order_id', orderId)
  await supabase.from('orders').delete().eq('id', orderId)
}

export async function changeOrderStatus(orderId: number) {
  await supabase
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', orderId)
}

export async function updateOrderItems(updatedOrder: Order) {
  type ExistingItem = {
    item_id: number
    quantity: number
  }
  const { data: existingItems, error } = await supabase
    .from('items_orders')
    .select('item_id, quantity')
    .eq('order_id', updatedOrder.id)
    .returns<ExistingItem[]>()

  if (error) {
    throw new Error('Error fetching existing items')
  }

  const updatedItemMap = new Map(
    updatedOrder.items.map((item) => [item.id!, item])
  )

  const deletePromises: any[] = []
  const updatePromises: any[] = []
  const insertPromises: any[] = []

  existingItems.forEach((existingItem) => {
    const updatedItem = updatedItemMap.get(existingItem.item_id)

    if (!updatedItem) {
      deletePromises.push(
        supabase
          .from('items_orders')
          .delete()
          .eq('order_id', updatedOrder.id)
          .eq('item_id', existingItem.item_id)
      )
    } else {
      if (updatedItem.quantity !== existingItem.quantity) {
        updatePromises.push(
          supabase
            .from('items_orders')
            .update({ quantity: updatedItem.quantity })
            .eq('order_id', updatedOrder.id)
            .eq('item_id', updatedItem.id)
        )
      }
      updatedItemMap.delete(existingItem.item_id)
    }
  })

  updatedItemMap.forEach((newItem, _) => {
    insertPromises.push(
      supabase.from('items_orders').insert({
        order_id: updatedOrder.id,
        item_id: newItem.id,
        quantity: newItem.quantity,
      })
    )
  })

  await Promise.all([...deletePromises, ...updatePromises, ...insertPromises])
}

export async function addItemImage(file: File) {
  // Check if the image already exists
  const { data: existingFiles, error: listError } = await supabase.storage
    .from('images')
    .list('', { search: file.name })

  if (listError) {
    throw new Error('Error checking existing image: ' + listError.message)
  }

  // If the image already exists, return the existing image URL
  if (existingFiles && existingFiles.length > 0) {
    return `${process.env.SUPABASE_URL}/storage/v1/object/public/images/${existingFiles[0].name}`
  }

  // Upload the image if it does not exist
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('images')
    .upload(file.name, file)

  if (uploadError) {
    throw new Error('Error uploading image: ' + uploadError.message)
  }

  return `${process.env.SUPABASE_URL}/storage/v1/object/public/images/${uploadData.path}`
}

export async function deleteItemImage(imageUrl: string) {
  const path = imageUrl.split('/').pop()
  if (!path) throw Error('Error deleting image')
  const { error } = await supabase.storage.from('images').remove([path])
  if (error) throw Error('Error deleting image')
}

export async function updateDeletedItem(itemId: number, deleted: boolean) {
  await supabase.from('items').update({ deleted }).eq('id', itemId)
}
