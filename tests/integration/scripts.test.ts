import { spawn } from 'child_process'
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import sharp from 'sharp'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createItem, prisma, resetDatabase } from '../helpers/db'

const ROOT = process.cwd()
const tempDirs: string[] = []
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sunflower-scripts-'))
  tempDirs.push(dir)
  return dir
}

function runScript(script: string, args: string[], options: { cwd?: string; env?: Record<string, string> } = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
      cwd: options.cwd ?? ROOT,
      env: { ...process.env, ...options.env },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

// A tiny HTTP server standing in for Supabase (REST + storage) or a remote image host
async function startServer(handler: http.RequestListener) {
  const server = http.createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as { port: number }
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(resolve)) }
}

const jpeg = () => sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffb300' } }).jpeg().toBuffer()

beforeEach(resetDatabase)
afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true })
})
afterAll(() => prisma.$disconnect())

describe('build-migration-package', () => {
  async function dashboardExport() {
    const sqlDir = tempDir()
    const imagesDir = tempDir()
    fs.writeFileSync(
      path.join(sqlDir, 'items_rows.sql'),
      `INSERT INTO "public"."items" ("id", "name", "image", "price", "deleted") VALUES ('1', 'Cup', 'https://x.supabase.co/storage/v1/object/public/items/cup.jpg', '10.5', 'false');\n` +
        `INSERT INTO "public"."items" ("id", "name", "image", "price", "deleted") VALUES (2, 'Mug', 'https://x.supabase.co/storage/v1/object/public/items/mug%20big.jpg', 4, true);`
    )
    fs.writeFileSync(path.join(sqlDir, 'orders_rows.sql'), `INSERT INTO "public"."orders" ("id", "status") VALUES (1, 'completed');`)
    fs.writeFileSync(
      path.join(sqlDir, 'items_orders_rows.sql'),
      `INSERT INTO "public"."items_orders" ("id", "order_id", "item_id", "quantity") VALUES (1, 1, 1, 2), (2, 1, 2, 1);`
    )
    fs.writeFileSync(path.join(imagesDir, 'cup.jpg'), 'cup')
    fs.writeFileSync(path.join(imagesDir, 'mug big.jpg'), 'mug')
    return { sqlDir, imagesDir }
  }

  it('builds a restorable package from the dashboard SQL files and images', async () => {
    const { sqlDir, imagesDir } = await dashboardExport()
    const cwd = tempDir()
    const result = await runScript('build-migration-package.js', ['--sql-dir', sqlDir, '--images-dir', imagesDir], { cwd })
    expect(result.code, result.stderr).toBe(0)

    const pkg = path.join(cwd, 'migration-package')
    const items = JSON.parse(fs.readFileSync(path.join(pkg, 'data', 'items.json'), 'utf8'))
    expect(items).toEqual([
      expect.objectContaining({ id: 1, price: 10.5, deleted: false, image: '/uploads/cup.jpg' }),
      expect.objectContaining({ id: 2, price: 4, deleted: true, image: '/uploads/mug big.jpg' }),
    ])
    expect(JSON.parse(fs.readFileSync(path.join(pkg, 'manifest.json'), 'utf8')).counts).toEqual({
      items: 2,
      orders: 1,
      itemsOrders: 2,
      images: 2,
    })
  })

  it('stops when an image is missing, unless told to continue', async () => {
    const { sqlDir, imagesDir } = await dashboardExport()
    fs.rmSync(path.join(imagesDir, 'cup.jpg'))
    const cwd = tempDir()

    const strict = await runScript('build-migration-package.js', ['--sql-dir', sqlDir, '--images-dir', imagesDir], { cwd })
    expect(strict.code).toBe(1)
    expect(strict.stderr).toMatch(/1 item image\(s\) not found/)

    const lenient = await runScript(
      'build-migration-package.js',
      ['--sql-dir', sqlDir, '--images-dir', imagesDir, '--allow-missing-images'],
      { cwd }
    )
    expect(lenient.code, lenient.stderr).toBe(0)
  })
})

describe('export-supabase-data', () => {
  it('exports tables and images, and keeps the previous package if a later export fails', async () => {
    const image = await jpeg()
    let failing = false
    const supabase = await startServer((req, res) => {
      const url = new URL(req.url!, 'http://localhost')
      if (failing) return res.writeHead(500).end('down')
      const tables: Record<string, unknown[]> = {
        items: [{ id: 1, name: 'Cup', image: `${server.url}/storage/v1/object/public/items/cup.jpg`, price: 10, deleted: false, created_at: '2025-01-01T10:00:00+00:00' }],
        orders: [{ id: 7, status: 'completed', created_at: '2025-01-02T10:00:00+00:00' }],
        items_orders: [{ id: 3, order_id: 7, item_id: 1, quantity: 2, created_at: '2025-01-02T10:00:00+00:00' }],
      }
      const table = url.pathname.match(/^\/rest\/v1\/(\w+)$/)?.[1]
      if (table && tables[table]) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(tables[table]))
      if (url.pathname.endsWith('/cup.jpg')) return res.writeHead(200, { 'Content-Type': 'image/jpeg' }).end(image)
      res.writeHead(404).end()
    })
    const server = supabase
    const cwd = tempDir()
    const env = { SUPABASE_URL: supabase.url, SUPABASE_API_KEY: 'test-key' }
    try {
      const first = await runScript('export-supabase-data.js', [], { cwd, env })
      expect(first.code, first.stderr).toBe(0)
      const pkg = path.join(cwd, 'migration-package')
      expect(fs.readdirSync(path.join(pkg, 'uploads'))).toEqual(['cup.jpg'])
      expect(JSON.parse(fs.readFileSync(path.join(pkg, 'data', 'items.json'), 'utf8'))[0].image).toBe('/uploads/cup.jpg')

      failing = true
      const second = await runScript('export-supabase-data.js', [], { cwd, env })
      expect(second.code).toBe(1)
      const previous = path.join(cwd, 'migration-package.previous')
      expect(fs.readdirSync(path.join(previous, 'uploads'))).toEqual(['cup.jpg'])
    } finally {
      await supabase.close()
    }
  })
})

describe('migrate-remote-images', () => {
  it('downloads remote images into the uploads folder and fails loudly on errors', async () => {
    const image = await jpeg()
    const host = await startServer((req, res) => {
      if (req.url === '/photos/cup.jpg') return res.writeHead(200, { 'Content-Type': 'image/jpeg' }).end(image)
      res.writeHead(404).end()
    })
    const uploads = tempDir()
    try {
      const cup = await createItem({ name: 'Cup', image: `${host.url}/photos/cup.jpg` })
      const lost = await createItem({ name: 'Lost', image: `${host.url}/photos/lost.jpg` })
      const result = await runScript('migrate-remote-images.js', [], { env: { UPLOADS_DIR: uploads } })

      expect(result.code).toBe(1)
      expect(result.stderr).toMatch(/1 of 2 image\(s\) failed/)
      const migrated = await prisma.item.findUniqueOrThrow({ where: { id: cup.id } })
      expect(migrated.image).toMatch(/^\/uploads\/.+\.jpg$/)
      expect(fs.existsSync(path.join(uploads, path.basename(migrated.image)))).toBe(true)
      expect((await prisma.item.findUniqueOrThrow({ where: { id: lost.id } })).image).toMatch(/^http/)
    } finally {
      await host.close()
    }
  })
})

describe('uploads:check', () => {
  it('lists items with missing photos and moves unused files out', async () => {
    const uploads = tempDir()
    const backups = tempDir()
    fs.writeFileSync(path.join(uploads, 'used.jpg'), 'x')
    fs.writeFileSync(path.join(uploads, 'unused.jpg'), 'x')
    await createItem({ name: 'Cup', image: '/uploads/used.jpg' })
    await createItem({ name: 'Mug', image: '/uploads/gone.jpg' })

    const result = await runScript('uploads-check.js', ['--move-unused'], {
      env: { UPLOADS_DIR: uploads, BACKUP_DIR: backups },
    })
    expect(result.code).toBe(1) // an item needs a new photo
    expect(result.stdout).toMatch(/Mug: \/uploads\/gone\.jpg/)
    expect(fs.readdirSync(uploads)).toEqual(['used.jpg'])
    const [moved] = fs.readdirSync(backups)
    expect(fs.readdirSync(path.join(backups, moved))).toEqual(['unused.jpg'])
  })
})

describe('doctor', () => {
  it('reports the database, migrations, images and a failed last backup', async () => {
    const uploads = tempDir()
    const backups = tempDir()
    fs.writeFileSync(path.join(uploads, 'cup.jpg'), 'x')
    await createItem({ name: 'Cup', image: '/uploads/cup.jpg' })
    fs.writeFileSync(
      path.join(backups, 'last-backup.json'),
      JSON.stringify({ ok: false, error: 'database not ready', at: new Date().toISOString() })
    )

    const result = await runScript('doctor.js', [], { env: { UPLOADS_DIR: uploads, BACKUP_DIR: backups, PRINTER_VID: '', PRINTER_PID: '' } })
    expect(result.stdout).toMatch(/✔ Database — 1 items/)
    expect(result.stdout).toMatch(/✔ Database schema — all migrations applied/)
    expect(result.stdout).toMatch(/✔ Item images — every item image exists/)
    expect(result.stdout).toMatch(/✖ Last backup — failed .*database not ready/)
    expect(result.code).toBe(1)
  })
})
