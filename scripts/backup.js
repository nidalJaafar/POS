/* eslint-disable no-console */
/**
 * Backs up every item, order and item image into a timestamped folder:
 *
 *   <BACKUP_DIR>/sunflower-backup-2026-10-17_14-30-05/
 *     data/items.json, data/orders.json, data/items_orders.json
 *     uploads/            ← copy of public/uploads
 *     manifest.json
 *
 * The folder uses the migration package format, so it restores with:
 *   npm run migration:restore -- --from <backup folder> --replace
 *
 * Usage:
 *   node scripts/backup.js [--dir <folder>] [--keep <n>] [--on-start]
 *
 *   --dir        where backups go (default: BACKUP_DIR env var, else ./backups)
 *   --keep       always keep this many newest backups (default: BACKUP_KEEP or 10)
 *   --keep-days  also keep the newest backup of each day for this many days
 *                (default: BACKUP_KEEP_DAYS or 60); anything older is deleted
 *   --on-start   never fail: used before `npm run start` so a backup problem can't stop the POS
 *
 * Every run records its result in <dir>/last-backup.json, which `npm run doctor` reads.
 */
const fs = require('fs')
const path = require('path')
const { PrismaClient, Prisma } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const {
  appUploadsDir,
  ensureDir,
  removePath,
  renameWithRetry,
  isSystemJunkFile,
  missingUploadReferences,
  validateExportRows,
  writeJson,
} = require('./migration-utils')

const BACKUP_PREFIX = 'sunflower-backup-'
const STATUS_FILE = 'last-backup.json'

function wholeNumber(value, name) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) throw new Error(`${name} must be a whole number of at least 1`)
  return number
}

function parseArgs(argv) {
  const options = {
    dir: process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'),
    keep: process.env.BACKUP_KEEP || 10,
    keepDays: process.env.BACKUP_KEEP_DAYS || 60,
    onStart: false,
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') options.dir = argv[++i]
    else if (argv[i] === '--keep') options.keep = argv[++i]
    else if (argv[i] === '--keep-days') options.keepDays = argv[++i]
    else if (argv[i] === '--on-start') options.onStart = true
    else throw new Error(`Unknown argument: ${argv[i]}`)
  }
  if (!options.dir) throw new Error('Backup folder is empty')
  options.keep = wholeNumber(options.keep, '--keep / BACKUP_KEEP')
  options.keepDays = wholeNumber(options.keepDays, '--keep-days / BACKUP_KEEP_DAYS')
  options.dir = path.resolve(options.dir)
  return options
}

function timestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  )
}

// Rows in the same snake_case shape as the Supabase export, so restore treats both alike
async function readSnapshot(prisma) {
  // One repeatable-read transaction gives a consistent snapshot even while the POS is in use
  return prisma.$transaction(
    async (tx) => {
      const [items, orders, itemsOrders] = await Promise.all([
        tx.item.findMany({ orderBy: { id: 'asc' } }),
        tx.order.findMany({ orderBy: { id: 'asc' } }),
        tx.orderItem.findMany({ orderBy: { id: 'asc' } }),
      ])
      return {
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          image: item.image,
          price: item.price,
          deleted: item.deleted,
          created_at: item.createdAt.toISOString(),
        })),
        orders: orders.map((order) => ({
          id: order.id,
          status: order.status,
          created_at: order.createdAt.toISOString(),
        })),
        itemsOrders: itemsOrders.map((row) => ({
          id: row.id,
          order_id: row.orderId,
          item_id: row.itemId,
          quantity: row.quantity,
          unit_price: row.unitPrice,
          created_at: row.createdAt.toISOString(),
        })),
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 5 * 60_000 }
  )
}

// Folder names sort by time: sunflower-backup-YYYY-MM-DD_HH-MM-SS
function backupDay(name) {
  return name.slice(BACKUP_PREFIX.length, BACKUP_PREFIX.length + 10)
}

/**
 * Keeps the `keep` newest backups, plus the newest backup of each day for `keepDays`
 * days, so restarting the POS several times a day can't push out last month's history.
 */
function pruneOldBackups(dir, keep, keepDays = 60, now = new Date()) {
  const backups = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(BACKUP_PREFIX))
    .map((entry) => entry.name)
    .sort()
    .reverse()
  const oldestDay = timestamp(new Date(now.getFullYear(), now.getMonth(), now.getDate() - keepDays + 1)).slice(0, 10)
  const keptDays = new Set()
  const removed = []
  backups.forEach((name, index) => {
    const day = backupDay(name)
    const newestOfItsDay = !keptDays.has(day)
    keptDays.add(day)
    if (index < keep || (newestOfItsDay && day >= oldestDay)) return
    removed.push(name)
  })
  for (const name of removed) removePath(path.join(dir, name))
  return removed.reverse()
}

// Copies regular image files; skips folders, links and OS junk instead of failing the backup
function copyUploads(sourceDir, targetDir) {
  ensureDir(targetDir)
  const skipped = []
  let count = 0
  if (!fs.existsSync(sourceDir)) return { count, skipped }
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (isSystemJunkFile(entry.name)) continue
    if (!entry.isFile()) {
      skipped.push(entry.name)
      continue
    }
    fs.copyFileSync(path.join(sourceDir, entry.name), path.join(targetDir, entry.name))
    count += 1
  }
  return { count, skipped }
}

function writeStatus(dir, status) {
  try {
    ensureDir(dir)
    writeJson(path.join(dir, STATUS_FILE), { ...status, at: new Date().toISOString() })
  } catch {
    // The status file is informational; never let it mask the real result
  }
}

async function createBackup({
  prisma,
  dir,
  keep = 10,
  keepDays = 60,
  now = new Date(),
  uploadsDir = appUploadsDir(),
}) {
  const snapshot = await readSnapshot(prisma)
  validateExportRows(snapshot)

  ensureDir(dir)
  const name = `${BACKUP_PREFIX}${timestamp(now)}`
  const finalDir = path.join(dir, name)
  if (fs.existsSync(finalDir)) throw new Error(`Backup already exists: ${finalDir}`)

  // Write into a temp folder and rename at the end so a half-written backup never
  // looks like a complete one
  const tempDir = path.join(dir, `.${name}.partial`)
  removePath(tempDir)
  const warnings = []
  let missingImages = []
  try {
    ensureDir(path.join(tempDir, 'data'))
    writeJson(path.join(tempDir, 'data', 'items.json'), snapshot.items)
    writeJson(path.join(tempDir, 'data', 'orders.json'), snapshot.orders)
    writeJson(path.join(tempDir, 'data', 'items_orders.json'), snapshot.itemsOrders)

    const uploads = copyUploads(uploadsDir, path.join(tempDir, 'uploads'))
    for (const entry of uploads.skipped) warnings.push(`Skipped ${entry} in the uploads folder (not a regular file)`)

    // A missing photo must not stop every backup: record it, and restore will accept it
    const missing = missingUploadReferences(snapshot.items, path.join(tempDir, 'uploads'))
    missingImages = [...new Set(missing.map((item) => item.image))]
    for (const item of missing) warnings.push(`Item #${item.id} ${item.name}: image file missing (${item.image})`)

    writeJson(path.join(tempDir, 'manifest.json'), {
      exportedAt: now.toISOString(),
      builtBy: 'backup.js',
      counts: {
        items: snapshot.items.length,
        orders: snapshot.orders.length,
        itemsOrders: snapshot.itemsOrders.length,
        images: uploads.count,
      },
      missingImages,
      warnings,
    })
    renameWithRetry(tempDir, finalDir)
  } catch (error) {
    removePath(tempDir)
    throw error
  }

  const removed = pruneOldBackups(dir, keep, keepDays, now)
  return {
    dir: finalDir,
    removed,
    warnings,
    counts: {
      items: snapshot.items.length,
      orders: snapshot.orders.length,
      itemsOrders: snapshot.itemsOrders.length,
    },
  }
}

async function main() {
  let options = { onStart: process.argv.includes('--on-start') }
  let statusDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups')
  let prisma
  let pool
  try {
    options = parseArgs(process.argv.slice(2))
    statusDir = options.dir
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ['error'] })

    const result = await createBackup({ prisma, dir: options.dir, keep: options.keep, keepDays: options.keepDays })
    console.log(`Backup saved to ${result.dir}`)
    console.log(
      `  ${result.counts.items} items, ${result.counts.orders} orders, ${result.counts.itemsOrders} order lines`
    )
    for (const warning of result.warnings) console.warn(`  Warning: ${warning}`)
    if (result.removed.length) console.log(`  Removed ${result.removed.length} old backup(s)`)
    writeStatus(options.dir, { ok: true, backup: path.basename(result.dir), warnings: result.warnings })
  } catch (error) {
    console.error('Backup failed:', error.message)
    writeStatus(statusDir, { ok: false, error: error.message })
    // Before startup a failed backup is logged, but the POS still starts
    if (!options.onStart) process.exitCode = 1
  } finally {
    if (prisma) await prisma.$disconnect()
    if (pool) await pool.end()
  }
}

if (require.main === module) main()

module.exports = { createBackup, pruneOldBackups, timestamp, BACKUP_PREFIX, STATUS_FILE }
