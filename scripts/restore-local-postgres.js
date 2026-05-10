/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const {
  DATA_DIR,
  UPLOADS_DIR,
  appUploadsDir,
  assertLocalDatabaseUrl,
  copyUploadsAtomically,
  normalizeSupabaseRow,
  packagePath,
  readJson,
  validateExportRows,
} = require('./migration-utils')

const connectionString = assertLocalDatabaseUrl(process.env.DATABASE_URL)

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter, log: ['error'] })

function assertPackageExists() {
  const requiredFiles = [
    path.join(DATA_DIR, 'items.json'),
    path.join(DATA_DIR, 'orders.json'),
    path.join(DATA_DIR, 'items_orders.json'),
    packagePath('manifest.json'),
  ]

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) throw new Error(`Missing migration package file: ${file}`)
  }

  if (!fs.existsSync(UPLOADS_DIR)) throw new Error(`Missing migration uploads folder: ${UPLOADS_DIR}`)
}

function copyUploads() {
  return copyUploadsAtomically(UPLOADS_DIR, appUploadsDir())
}

async function resetSequences() {
  await prisma.$executeRawUnsafe("SELECT setval(pg_get_serial_sequence('items', 'id'), COALESCE((SELECT MAX(id) FROM items), 1), (SELECT COUNT(*) > 0 FROM items))")
  await prisma.$executeRawUnsafe("SELECT setval(pg_get_serial_sequence('orders', 'id'), COALESCE((SELECT MAX(id) FROM orders), 1), (SELECT COUNT(*) > 0 FROM orders))")
  await prisma.$executeRawUnsafe("SELECT setval(pg_get_serial_sequence('items_orders', 'id'), COALESCE((SELECT MAX(id) FROM items_orders), 1), (SELECT COUNT(*) > 0 FROM items_orders))")
}

async function run() {
  assertPackageExists()

  const items = readJson(path.join(DATA_DIR, 'items.json'))
  const orders = readJson(path.join(DATA_DIR, 'orders.json'))
  const itemsOrders = readJson(path.join(DATA_DIR, 'items_orders.json'))
  const manifest = readJson(packagePath('manifest.json'))

  validateExportRows({ items, orders, itemsOrders })

  console.log('Restoring local PostgreSQL database...')

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany()
    await tx.order.deleteMany()
    await tx.item.deleteMany()

    for (const row of items) {
      const item = normalizeSupabaseRow(row)
      await tx.item.create({
        data: {
          id: item.id,
          name: item.name,
          image: item.image,
          price: item.price,
          deleted: item.deleted ?? false,
          createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
        },
      })
    }

    for (const row of orders) {
      const order = normalizeSupabaseRow(row)
      await tx.order.create({
        data: {
          id: order.id,
          status: order.status,
          createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
        },
      })
    }

    for (const row of itemsOrders) {
      const orderItem = normalizeSupabaseRow(row)
      await tx.orderItem.create({
        data: {
          id: orderItem.id,
          orderId: orderItem.orderId,
          itemId: orderItem.itemId,
          quantity: orderItem.quantity,
          createdAt: orderItem.createdAt ? new Date(orderItem.createdAt) : undefined,
        },
      })
    }
  })

  await resetSequences()
  const copiedImages = copyUploads()

  const [itemCount, orderCount, orderItemCount] = await Promise.all([
    prisma.item.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
  ])

  console.log('Restore complete.')
  console.log(`Items: ${itemCount} / manifest ${manifest.counts.items}`)
  console.log(`Orders: ${orderCount} / manifest ${manifest.counts.orders}`)
  console.log(`Order items: ${orderItemCount} / manifest ${manifest.counts.itemsOrders}`)
  console.log(`Images copied: ${copiedImages} / manifest ${manifest.counts.images}`)

  if (itemCount !== manifest.counts.items || orderCount !== manifest.counts.orders || orderItemCount !== manifest.counts.itemsOrders) {
    throw new Error('Restored row counts do not match manifest counts')
  }
}

run()
  .catch((error) => {
    console.error('Restore failed:', error.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
