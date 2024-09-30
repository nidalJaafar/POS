'use server'
import { Order, OrderItem } from '@/lib/dto'
import {
  addItemImage,
  addOrder,
  changeOrderStatus,
  deleteOrder,
  getOrder,
  updateDeletedItem,
  updateOrderItems,
  upsertItem,
} from '@/lib/supabase/supabase-operations'
import { revalidatePath } from 'next/cache'
import { redirect, RedirectType } from 'next/navigation'
import sendToThermalPrinter from './printer'

export async function placeOrder(items: OrderItem[]) {
  await addOrder(items)
  revalidatePath('/orders')
  redirect('/orders', RedirectType.push)
}

export async function deletePendingOrder(orderId: number) {
  await deleteOrder(orderId)
  revalidatePath('/orders')
  redirect('/orders', RedirectType.push)
}

export async function completePendingOrder(orderId: number) {
  await changeOrderStatus(orderId)
  const order = await getOrder(orderId)
  await sendToThermalPrinter(order)
  revalidatePath('/orders')
  revalidatePath('/orders/completed')
  revalidatePath(`/orders/${orderId}`)
  redirect('/orders/completed', RedirectType.push)
}

export async function updateOrderItemsAction(updatedOrder: Order) {
  await updateOrderItems(updatedOrder)
  revalidatePath('/orders')
  revalidatePath(`/orders/${updatedOrder.id}`)
  redirect(`/orders/${updatedOrder.id}`, RedirectType.push)
}

export async function addItemToMenu(formData: FormData) {
  const image = formData.get('image')
  const name = formData.get('name') as string
  const price = Number(formData.get('price'))
  const id = Number(formData.get('id'))

  if (!image || !name || !price) {
    throw new Error('Missing required fields')
  }
  const imageUrl = typeof image === 'string' ? image : await addItemImage(image)

  const item: {
    image: string
    name: string
    price: number
    deleted: boolean
    id?: number
  } = {
    image: imageUrl,
    name,
    price,
    deleted: false,
  }
  if (id) item.id = id
  await upsertItem(item)
  revalidatePath('/')
}

export async function updateIsDeleted(itemId: number, isDeleted: boolean) {
  await updateDeletedItem(itemId, isDeleted)
}
