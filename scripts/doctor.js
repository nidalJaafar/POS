/* eslint-disable no-console */
/**
 * Checks that this machine is ready to run the POS and prints what to fix.
 *
 *   npm run doctor
 *
 * Checks: env file, database connection, pending migrations, uploads folder,
 * item images, production build, receipt printer and recent backups.
 */
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const { appUploadsDir, runPrisma } = require('./migration-utils')

const results = []
function report(status, label, detail = '') {
  results.push(status)
  const icon = { ok: '✔', warn: '!', fail: '✖' }[status]
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ''}`)
}

async function checkDatabase() {
  if (!process.env.DATABASE_URL) {
    report('fail', 'DATABASE_URL', 'not set in .env.local')
    return null
  }
  const { PrismaClient } = require('@prisma/client')
  const { PrismaPg } = require('@prisma/adapter-pg')
  const { Pool } = require('pg')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: [] })
  try {
    const [items, orders, pending] = await Promise.all([
      prisma.item.findMany({ select: { id: true, image: true } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'pending' } }),
    ])
    report('ok', 'Database', `${items.length} items, ${orders} orders (${pending} pending)`)
    return items
  } catch (error) {
    report('fail', 'Database', `cannot connect or query: ${error.message.split('\n')[0]}`)
    return null
  } finally {
    await prisma.$disconnect().catch(() => {})
    await pool.end().catch(() => {})
  }
}

function checkMigrations() {
  try {
    runPrisma(['migrate', 'status'], { stdio: 'pipe', encoding: 'utf8' })
    report('ok', 'Database schema', 'all migrations applied')
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    if (/not yet been applied|following migration/i.test(output)) {
      report('fail', 'Database schema', 'migrations pending — run: npm run db:migrate')
    } else {
      report('warn', 'Database schema', 'could not check migration status')
    }
  }
}

function checkUploads(items) {
  const dir = appUploadsDir()
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.accessSync(dir, fs.constants.W_OK)
    report('ok', 'Uploads folder', dir)
  } catch {
    report('fail', 'Uploads folder', `${dir} is not writable`)
    return
  }
  if (!items) return
  const missing = items.filter(
    (item) => item.image.startsWith('/uploads/') && !fs.existsSync(path.join(dir, path.basename(item.image)))
  )
  const remote = items.filter((item) => /^https?:/i.test(item.image))
  if (missing.length) report('warn', 'Item images', `${missing.length} missing file(s) — run: npm run uploads:check`)
  else report('ok', 'Item images', 'every item image exists')
  if (remote.length) report('warn', 'Remote images', `${remote.length} item(s) still load images from the internet — run: npm run migrate:remote-images`)
}

function checkBuild() {
  const buildId = path.join(process.cwd(), '.next', 'BUILD_ID')
  if (!fs.existsSync(buildId)) {
    report('fail', 'Production build', 'missing — run: npm run build')
    return
  }
  const builtAt = fs.statSync(buildId).mtime
  const newerSource = ['src', 'prisma', 'public']
    .map((dir) => newestFile(path.join(process.cwd(), dir), ['uploads']))
    .some((time) => time > builtAt)
  if (newerSource) report('warn', 'Production build', `older than the code (built ${builtAt.toLocaleString()}) — run: npm run build`)
  else report('ok', 'Production build', `built ${builtAt.toLocaleString()}`)
}

function newestFile(dir, skip = []) {
  let newest = new Date(0)
  if (!fs.existsSync(dir)) return newest
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    const time = entry.isDirectory() ? newestFile(full, skip) : fs.statSync(full).mtime
    if (time > newest) newest = time
  }
  return newest
}

function checkPrinter() {
  const { PRINTER_VID, PRINTER_PID } = process.env
  if (!PRINTER_VID || !PRINTER_PID) {
    report('warn', 'Receipt printer', 'PRINTER_VID / PRINTER_PID not set; receipts are disabled')
    return
  }
  try {
    const usb = require('usb')
    const device = usb.findByIds(Number(PRINTER_VID), Number(PRINTER_PID))
    if (device) report('ok', 'Receipt printer', `found ${PRINTER_VID}:${PRINTER_PID}`)
    else report('warn', 'Receipt printer', `${PRINTER_VID}:${PRINTER_PID} not connected — run: npm run printer:list`)
  } catch (error) {
    report('warn', 'Receipt printer', `USB support unavailable: ${error.message.split('\n')[0]}`)
  }
}

function checkBackups() {
  const dir = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'))
  let status = null
  try {
    status = JSON.parse(fs.readFileSync(path.join(dir, 'last-backup.json'), 'utf8'))
  } catch {}
  if (status && !status.ok) {
    report('fail', 'Last backup', `failed ${new Date(status.at).toLocaleString()}: ${status.error}`)
  } else if (status?.warnings?.length) {
    report('warn', 'Last backup', `${status.warnings.length} warning(s), e.g. ${status.warnings[0]}`)
  }

  const backups = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => name.startsWith('sunflower-backup-')).sort()
    : []
  if (!backups.length) {
    report('warn', 'Backups', `none in ${dir} — run: npm run backup`)
    return
  }
  const latest = backups[backups.length - 1]
  const age = Date.now() - fs.statSync(path.join(dir, latest)).mtimeMs
  const days = Math.floor(age / (24 * 60 * 60 * 1000))
  report(days > 7 ? 'warn' : 'ok', 'Backups', `${backups.length} kept, latest ${latest}${days > 7 ? ` (${days} days old)` : ''}`)
}

async function main() {
  const { version } = require('../package.json')
  console.log(`Sunflower Crafts POS ${version} — health check\n`)
  if (!fs.existsSync('.env.local')) report('fail', '.env.local', 'missing in the project folder')
  const items = await checkDatabase()
  if (items) checkMigrations()
  checkUploads(items)
  checkBuild()
  checkPrinter()
  checkBackups()

  const failures = results.filter((status) => status === 'fail').length
  const warnings = results.filter((status) => status === 'warn').length
  console.log(`\n${failures} problem(s), ${warnings} warning(s)`)
  if (failures) process.exitCode = 1
}

main()
