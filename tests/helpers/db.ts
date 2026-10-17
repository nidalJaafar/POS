import { prisma } from '@/lib/prisma'

export { prisma }

export async function resetDatabase() {
  await prisma.$executeRawUnsafe('TRUNCATE items_orders, orders, items RESTART IDENTITY CASCADE')
}

let itemCounter = 0

export async function createItem(overrides: Partial<{ name: string; price: number; image: string; deleted: boolean }> = {}) {
  itemCounter += 1
  return prisma.item.create({
    data: {
      name: overrides.name ?? `Item ${itemCounter}`,
      price: overrides.price ?? 10,
      image: overrides.image ?? `/uploads/item-${itemCounter}.jpg`,
      deleted: overrides.deleted ?? false,
    },
  })
}

export async function createOrder(options: {
  status?: 'pending' | 'completed'
  createdAt?: Date
  lines: { itemId: number; quantity: number; unitPrice: number }[]
}) {
  return prisma.order.create({
    data: {
      status: options.status ?? 'pending',
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
      itemsOrders: { create: options.lines },
    },
  })
}
