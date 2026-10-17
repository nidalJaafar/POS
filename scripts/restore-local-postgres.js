/* eslint-disable no-console */
/**
 * Restores a package (from the Supabase export, build-migration-package.js or
 * backup.js) into the local PostgreSQL database and public/uploads.
 *
 * Usage:
 *   node scripts/restore-local-postgres.js [--from <package-dir>] [--replace] [--no-backup]
 *
 *   --from       package folder (default: ./migration-package)
 *   --replace    required when the database already has data; that data is replaced
 *   --no-backup  with --replace, skip the automatic backup of the data being replaced
 *
 * Stop the POS first: on Windows a running app keeps the uploads folder locked.
 */
const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const {
  PACKAGE_DIR,
  appUploadsDir,
  assertLocalDatabaseUrl,
  normalizeSupabaseRow,
  readJson,
  stageUploads,
  validateExportRows,
  validateRestoredUploads,
} = require('./migration-utils')

function parseArgs(argv) {
  const options = { packageDir: PACKAGE_DIR, replace: false, backup: true }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from') options.packageDir = path.resolve(argv[++i] ?? '')
    else if (argv[i] === '--replace') options.replace = true
    else if (argv[i] === '--no-backup') options.backup = false
    else throw new Error(`Unknown argument: ${argv[i]}`)
  }
  return options
}

const options = parseArgs(process.argv.slice(2))
const connectionString = assertLocalDatabaseUrl(process.env.DATABASE_URL)

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter, log: ['error'] })

const dataDir = path.join(options.packageDir, 'data')
const uploadsDir = path.join(options.packageDir, 'uploads')
const manifestPath = path.join(options.packageDir, 'manifest.json')

function assertPackageExists() {
  const requiredFiles = [
    path.join(dataDir, 'items.json'),
    path.join(dataDir, 'orders.json'),
    path.join(dataDir, 'items_orders.json'),
    manifestPath,
  ]

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) throw new Error(`Missing migration package file: ${file}`)
  }

  if (!fs.existsSync(uploadsDir)) throw new Error(`Missing migration uploads folder: ${uploadsDir}`)
}

const RESET_SEQUENCES = ['items', 'orders', 'items_orders'].map(
  (table) =>
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), (SELECT COUNT(*) > 0 FROM ${table}))`
)

function toDate(value) {
  return value ? new Date(value) : undefined
}

async function run() {
  assertPackageExists()

  const items = readJson(path.join(dataDir, 'items.json'))
  const orders = readJson(path.join(dataDir, 'orders.json'))
  const itemsOrders = readJson(path.join(dataDir, 'items_orders.json'))
  const manifest = readJson(manifestPath)

  validateExportRows({ items, orders, itemsOrders })

  const [existingItems, existingOrders] = await Promise.all([prisma.item.count(), prisma.order.count()])
  if ((existingItems > 0 || existingOrders > 0) && !options.replace) {
    throw new Error(
      `The database already has ${existingItems} items and ${existingOrders} orders. ` +
        'Re-run with --replace to overwrite them (a backup of them is taken first).'
    )
  }

  // Whatever is about to be replaced is saved first, so a wrong --from is recoverable
  if ((existingItems > 0 || existingOrders > 0) && options.backup) {
    const { createBackup } = require('./backup')
    const dir = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'))
    const safety = await createBackup({ prisma, dir })
    console.log(`Backed up the current data to ${safety.dir}`)
  }

  // Copy images aside and check them before touching the database or public/uploads
  const staged = stageUploads(uploadsDir, appUploadsDir())
  try {
    validateRestoredUploads({ items, uploadsDir: staged.dir, copiedImages: staged.count, manifest })

    // Packages exported from Supabase have no price snapshot; use the item's price
    const itemPrices = new Map(items.map((item) => [item.id, item.price]))

    console.log(`Restoring local PostgreSQL database from ${options.packageDir}...`)

    await prisma.$transaction(
      async (tx) => {
        await tx.orderItem.deleteMany()
        await tx.order.deleteMany()
        await tx.item.deleteMany()

        await tx.item.createMany({
          data: items.map(normalizeSupabaseRow).map((item) => ({
            id: item.id,
            name: item.name,
            image: item.image,
            price: item.price,
            deleted: item.deleted ?? false,
            createdAt: toDate(item.createdAt),
          })),
        })

        await tx.order.createMany({
          data: orders.map(normalizeSupabaseRow).map((order) => ({
            id: order.id,
            status: order.status,
            createdAt: toDate(order.createdAt),
          })),
        })

        await tx.orderItem.createMany({
          data: itemsOrders.map(normalizeSupabaseRow).map((orderItem) => ({
            id: orderItem.id,
            orderId: orderItem.orderId,
            itemId: orderItem.itemId,
            quantity: orderItem.quantity,
            unitPrice: orderItem.unit_price ?? itemPrices.get(orderItem.itemId),
            createdAt: toDate(orderItem.createdAt),
          })),
        })

        for (const statement of RESET_SEQUENCES) await tx.$executeRawUnsafe(statement)

        const [itemCount, orderCount, orderItemCount] = await Promise.all([
          tx.item.count(),
          tx.order.count(),
          tx.orderItem.count(),
        ])
        console.log(`Items: ${itemCount} / manifest ${manifest.counts.items}`)
        console.log(`Orders: ${orderCount} / manifest ${manifest.counts.orders}`)
        console.log(`Order items: ${orderItemCount} / manifest ${manifest.counts.itemsOrders}`)
        if (
          itemCount !== manifest.counts.items ||
          orderCount !== manifest.counts.orders ||
          orderItemCount !== manifest.counts.itemsOrders
        ) {
          // Throwing here rolls the whole restore back
          throw new Error('Restored row counts do not match manifest counts')
        }
      },
      { maxWait: 10_000, timeout: 10 * 60_000 }
    )
  } catch (error) {
    staged.discard()
    throw error
  }

  try {
    staged.commit()
  } catch (error) {
    staged.discard()
    throw new Error(
      `Database restored, but replacing the uploads folder failed (${error.message}). ` +
        'If the POS is running, stop it, then copy the files from ' +
        `${uploadsDir} into ${appUploadsDir()}.`
    )
  }

  console.log(`Images copied: ${staged.count} / manifest ${manifest.counts.images}`)
  console.log('Restore complete.')
}

run()
  .catch((error) => {
    console.error('Restore failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
