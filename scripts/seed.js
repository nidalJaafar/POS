/* eslint-disable no-console */
/**
 * Fills the local database with ~3000 random orders for development.
 * It adds to whatever is there, so it is guarded by a flag:
 *
 *   node scripts/seed.js --yes-add-fake-orders
 */
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const { assertLocalDatabaseUrl } = require('./migration-utils')

if (!process.argv.includes('--yes-add-fake-orders')) {
  console.error('seed.js adds thousands of fake orders to the database in DATABASE_URL.')
  console.error('Never run it on the shop laptop. To continue: node scripts/seed.js --yes-add-fake-orders')
  process.exit(1)
}

const connectionString = assertLocalDatabaseUrl(process.env.DATABASE_URL)

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter, log: ['error'] })

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

async function run() {
  // ── Items ────────────────────────────────────────────────────────────────
  const items = await prisma.item.findMany({ where: { deleted: false } })
  if (items.length === 0) {
    console.log('No items found in the database. Add items first.')
    return
  }
  console.log(`Found ${items.length} existing items.`)

  // ── Orders ───────────────────────────────────────────────────────────────
  const ORDER_COUNT = 3000
  const now = new Date()
  const start = new Date(now)
  start.setMonth(start.getMonth() - 18) // 1.5 years ago

  console.log(`Seeding ${ORDER_COUNT} orders...`)
  for (let i = 0; i < ORDER_COUNT; i++) {
    const status = Math.random() < 0.15 ? 'pending' : 'completed' // ~15% pending
    const createdAt = randomDate(start, now)
    const pickedItems = pickRandom(items, randomBetween(1, 5))

    await prisma.order.create({
      data: {
        status,
        createdAt,
        itemsOrders: {
          create: pickedItems.map((item) => ({
            itemId: item.id,
            quantity: randomBetween(1, 4),
            unitPrice: item.price,
            createdAt,
          })),
        },
      },
    })
    process.stdout.write(`\r  orders: ${i + 1}/${ORDER_COUNT}`)
  }
  console.log()

  console.log('\nDone. Update item names and prices from the app UI.')
}

run()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
