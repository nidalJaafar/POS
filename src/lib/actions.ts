'use server'
import { Order, OrderItem } from '@/lib/dto'
import {
  addOrder,
  changeOrderStatus,
  deleteOrder,
  getOrder,
  updateDeletedItem,
  updateOrderItems,
  upsertItem,
} from '@/lib/prisma/operations'
import { addItemImage } from '@/lib/storage'
import { revalidatePath } from 'next/cache'
import { redirect, RedirectType } from 'next/navigation'
import sendToThermalPrinter from './printer'

export async function placeOrder(items: OrderItem[], createdAt: string) {
  await addOrder(items, createdAt)
  revalidatePath('/orders')
  redirect('/orders', RedirectType.push)
}

export async function deletePendingOrder(orderId: number) {
  await deleteOrder(orderId)
  revalidatePath('/orders')
  redirect('/orders', RedirectType.push)
}

export async function completePendingOrder(orderId: number) {
  const completed = await changeOrderStatus(orderId)
  if (completed && process.env.PRINTER_VID && process.env.PRINTER_PID) {
    // The order is already completed; a printer problem must not block the cashier
    try {
      await sendToThermalPrinter(await getOrder(orderId))
    } catch (error) {
      console.error(`Receipt for order ${orderId} failed to print:`, error)
    }
  }
  revalidatePath('/orders')
  revalidatePath('/orders/completed')
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/dashboard')
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
  const name = String(formData.get('name') ?? '').trim()
  const rawPrice = String(formData.get('price') ?? '').trim()
  const price = Number(rawPrice)
  const id = Number(formData.get('id'))

  if (!image || !name || !rawPrice) throw new Error('Missing required fields')
  if (!Number.isFinite(price) || price < 0) throw new Error('Price must be zero or more')

  const imageUrl = typeof image === 'string' ? image : await addItemImage(image)
  await upsertItem({ image: imageUrl, name, price, deleted: false, ...(id ? { id } : {}) })
  revalidatePath('/')
  revalidatePath('/dashboard')
}

export async function updateIsDeleted(itemId: number, isDeleted: boolean) {
  await updateDeletedItem(itemId, isDeleted)
  revalidatePath('/')
}
