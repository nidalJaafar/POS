import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createItem, createOrder, prisma, resetDatabase } from '../helpers/db'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createBackup, pruneOldBackups, BACKUP_PREFIX, STATUS_FILE } = require('../../scripts/backup.js')

const run = promisify(execFile)
const tempDirs: string[] = []
function tempDir(prefix = 'sunflower-backup-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

let uploadsDir: string
beforeEach(async () => {
  await resetDatabase()
  uploadsDir = tempDir('sunflower-app-uploads-')
})
afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true })
})
afterAll(() => prisma.$disconnect())

async function seedShop() {
  fs.writeFileSync(path.join(uploadsDir, 'cup.jpg'), 'cup-image')
  fs.writeFileSync(path.join(uploadsDir, 'mug.jpg'), 'mug-image')
  const cup = await createItem({ name: 'Cup', price: 10, image: '/uploads/cup.jpg' })
  const mug = await createItem({ name: 'Mug', price: 4, image: '/uploads/mug.jpg', deleted: true })
  await createOrder({
    status: 'completed',
    createdAt: new Date('2026-05-01T09:15:00Z'),
    lines: [
      { itemId: cup.id, quantity: 2, unitPrice: 9 },
      { itemId: mug.id, quantity: 1, unitPrice: 4 },
    ],
  })
  await createOrder({ lines: [{ itemId: cup.id, quantity: 1, unitPrice: 10 }] })
}

async function dump() {
  const [items, orders, lines] = await Promise.all([
    prisma.item.findMany({ orderBy: { id: 'asc' } }),
    prisma.order.findMany({ orderBy: { id: 'asc' } }),
    prisma.orderItem.findMany({ orderBy: { id: 'asc' } }),
  ])
  return { items, orders, lines }
}

function restore(args: string[], targetUploads: string) {
  return run(process.execPath, ['scripts/restore-local-postgres.js', ...args], {
    env: { ...process.env, UPLOADS_DIR: targetUploads },
  })
}

describe('backup', () => {
  it('writes data, images and a manifest into a timestamped folder', async () => {
    await seedShop()
    const dir = tempDir()
    const result = await createBackup({ prisma, dir, keep: 5, uploadsDir, now: new Date(2026, 9, 17, 14, 30, 5) })

    expect(path.basename(result.dir)).toBe(`${BACKUP_PREFIX}2026-10-17_14-30-05`)
    expect(fs.readdirSync(path.join(result.dir, 'uploads')).sort()).toEqual(['cup.jpg', 'mug.jpg'])
    const manifest = JSON.parse(fs.readFileSync(path.join(result.dir, 'manifest.json'), 'utf8'))
    expect(manifest.counts).toEqual({ items: 2, orders: 2, itemsOrders: 3, images: 2 })
    const lines = JSON.parse(fs.readFileSync(path.join(result.dir, 'data', 'items_orders.json'), 'utf8'))
    expect(lines[0]).toMatchObject({ quantity: 2, unit_price: 9 })
  })

  it('still backs up when an item image is missing, records it, and the backup restores', async () => {
    await seedShop()
    await createItem({ name: 'Lost photo', image: '/uploads/gone.jpg' })
    fs.mkdirSync(path.join(uploadsDir, 'stray-folder'))
    const before = await dump()

    const result = await createBackup({ prisma, dir: tempDir(), uploadsDir })
    const manifest = JSON.parse(fs.readFileSync(path.join(result.dir, 'manifest.json'), 'utf8'))
    expect(manifest.missingImages).toEqual(['/uploads/gone.jpg'])
    expect(result.warnings.join('\n')).toMatch(/Lost photo: image file missing/)
    expect(result.warnings.join('\n')).toMatch(/Skipped stray-folder/)

    await resetDatabase()
    await restore(['--from', result.dir], path.join(tempDir(), 'uploads'))
    expect(await dump()).toEqual(before)
  })

  it('keeps the newest backups plus one per day for the retention window', () => {
    const dir = tempDir()
    const names = [
      '2026-10-17_18-00-00', '2026-10-17_12-00-00', '2026-10-17_09-00-00', // today, 3 restarts
      '2026-10-16_17-00-00', '2026-10-16_08-00-00',
      '2026-10-01_10-00-00',
      '2026-08-01_10-00-00', // older than the 60-day window
    ].map((stamp) => `${BACKUP_PREFIX}${stamp}`)
    for (const name of names) fs.mkdirSync(path.join(dir, name))
    fs.mkdirSync(path.join(dir, 'unrelated-folder'))

    const removed = pruneOldBackups(dir, 2, 60, new Date(2026, 9, 17, 19))
    expect(removed).toEqual([
      `${BACKUP_PREFIX}2026-08-01_10-00-00`,
      `${BACKUP_PREFIX}2026-10-16_08-00-00`,
      `${BACKUP_PREFIX}2026-10-17_09-00-00`,
    ])
    // Newest two, plus the newest of 10-16 and 10-01
    expect(fs.readdirSync(dir).sort()).toEqual(
      [...names.slice(0, 2), names[3], names[5]].sort().concat('unrelated-folder').sort()
    )
  })

  it('runs from the command line and records success', async () => {
    await seedShop()
    const dir = tempDir()
    const { stdout } = await run(process.execPath, ['scripts/backup.js', '--dir', dir], {
      env: { ...process.env, UPLOADS_DIR: uploadsDir },
    })
    expect(stdout).toMatch(/Backup saved to/)
    expect(fs.readdirSync(dir).filter((name) => name.startsWith(BACKUP_PREFIX))).toHaveLength(1)
    expect(JSON.parse(fs.readFileSync(path.join(dir, STATUS_FILE), 'utf8'))).toMatchObject({ ok: true })
  })

  it('--on-start never fails, but records the failure for doctor', async () => {
    const dir = tempDir()
    const result = await run(process.execPath, ['scripts/backup.js', '--on-start', '--dir', dir], {
      env: { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/sunflower_crafts_pos' },
    })
    expect(result.stderr).toMatch(/Backup failed/)
    expect(JSON.parse(fs.readFileSync(path.join(dir, STATUS_FILE), 'utf8'))).toMatchObject({ ok: false })
  })
})

describe('restore', () => {
  it('round-trips a backup exactly, images included', async () => {
    await seedShop()
    const before = await dump()
    const backup = await createBackup({ prisma, dir: tempDir(), keep: 5, uploadsDir })

    await resetDatabase()
    const restoredUploads = path.join(tempDir(), 'uploads')
    await restore(['--from', backup.dir], restoredUploads)

    expect(await dump()).toEqual(before)
    expect(fs.readdirSync(restoredUploads).sort()).toEqual(['cup.jpg', 'mug.jpg'])
  })

  it('continues ids after the restored rows', async () => {
    await seedShop()
    const backup = await createBackup({ prisma, dir: tempDir(), keep: 5, uploadsDir })
    await resetDatabase()
    await restore(['--from', backup.dir], path.join(tempDir(), 'uploads'))

    const next = await prisma.order.create({ data: { status: 'pending' } })
    expect(next.id).toBe(3)
  })

  it('refuses to overwrite existing data without --replace', async () => {
    await seedShop()
    const backup = await createBackup({ prisma, dir: tempDir(), keep: 5, uploadsDir })
    await createItem({ name: 'Sold after the backup' })

    await expect(restore(['--from', backup.dir], path.join(tempDir(), 'uploads'))).rejects.toMatchObject({
      stderr: expect.stringMatching(/already has 3 items.*--replace/s),
    })
    expect(await prisma.item.count()).toBe(3)

    const safetyDir = tempDir()
    const { stdout } = await run(process.execPath, ['scripts/restore-local-postgres.js', '--from', backup.dir, '--replace'], {
      env: { ...process.env, UPLOADS_DIR: uploadsDir, BACKUP_DIR: safetyDir },
    })
    expect(await prisma.item.count()).toBe(2)

    // The 3 items that were replaced were saved first
    expect(stdout).toMatch(/Backed up the current data/)
    const [safety] = fs.readdirSync(safetyDir).filter((name) => name.startsWith(BACKUP_PREFIX))
    const saved = JSON.parse(fs.readFileSync(path.join(safetyDir, safety, 'data', 'items.json'), 'utf8'))
    expect(saved.map((item: { name: string }) => item.name)).toContain('Sold after the backup')
  })

  it('rolls everything back when the restore fails after deleting the old rows', async () => {
    await seedShop()
    const backup = await createBackup({ prisma, dir: tempDir(), keep: 5, uploadsDir })
    // Valid data whose counts don't match the manifest: caught only after the inserts
    const manifestPath = path.join(backup.dir, 'manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, counts: { ...manifest.counts, orders: 99 } }))

    await createItem({ name: 'Current item' })
    const before = await dump()
    const liveUploads = path.join(tempDir(), 'uploads')
    fs.mkdirSync(liveUploads)
    fs.writeFileSync(path.join(liveUploads, 'current.jpg'), 'current')

    await expect(restore(['--from', backup.dir, '--replace', '--no-backup'], liveUploads)).rejects.toMatchObject({
      stderr: expect.stringMatching(/row counts do not match/),
    })
    expect(await dump()).toEqual(before)
    expect(fs.readdirSync(liveUploads)).toEqual(['current.jpg'])
  })

  it('leaves the database and images untouched when the package is broken', async () => {
    await seedShop()
    const backup = await createBackup({ prisma, dir: tempDir(), keep: 5, uploadsDir })
    fs.rmSync(path.join(backup.dir, 'uploads', 'cup.jpg'))

    const liveUploads = path.join(tempDir(), 'uploads')
    fs.mkdirSync(liveUploads)
    fs.writeFileSync(path.join(liveUploads, 'existing.jpg'), 'keep me')
    const before = await dump()

    await expect(restore(['--from', backup.dir, '--replace'], liveUploads)).rejects.toMatchObject({
      stderr: expect.stringMatching(/missing restored upload/),
    })
    expect(await dump()).toEqual(before)
    expect(fs.readdirSync(liveUploads)).toEqual(['existing.jpg'])
  })

  it('fills unit prices from item prices for Supabase exports that have none', async () => {
    const pkg = tempDir()
    fs.mkdirSync(path.join(pkg, 'data'))
    fs.mkdirSync(path.join(pkg, 'uploads'))
    fs.writeFileSync(path.join(pkg, 'uploads', 'cup.jpg'), 'x')
    const write = (name: string, value: unknown) =>
      fs.writeFileSync(path.join(pkg, name), JSON.stringify(value))
    write('data/items.json', [{ id: 5, name: 'Cup', image: '/uploads/cup.jpg', price: 7.5, deleted: false, created_at: '2025-01-01T10:00:00+00:00' }])
    write('data/orders.json', [{ id: 9, status: 'completed', created_at: '2025-01-02T10:00:00+00:00' }])
    write('data/items_orders.json', [{ id: 1, order_id: 9, item_id: 5, quantity: 3, created_at: '2025-01-02T10:00:00+00:00' }])
    write('manifest.json', { counts: { items: 1, orders: 1, itemsOrders: 1, images: 1 } })

    await restore(['--from', pkg], path.join(tempDir(), 'uploads'))
    expect(await prisma.orderItem.findFirstOrThrow()).toMatchObject({ orderId: 9, itemId: 5, quantity: 3, unitPrice: 7.5 })
  })
})
