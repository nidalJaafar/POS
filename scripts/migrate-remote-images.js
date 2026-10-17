/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const { appUploadsDir, assertLocalDatabaseUrl, buildSafeSourceDescriptor } = require('./migration-utils')

const connectionString = assertLocalDatabaseUrl(process.env.DATABASE_URL)
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 60_000

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter, log: ['error'] })

async function ensureUploadsDir() {
  const uploadsDir = appUploadsDir()
  await fs.promises.mkdir(uploadsDir, { recursive: true })
  return uploadsDir
}

async function downloadToUploads(url) {
  const uploadsDir = await ensureUploadsDir()
  const encodedUrl = encodeURI(url)
  const response = await fetch(encodedUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
  }
  const contentLength = Number(response.headers.get('content-length'))
  if (contentLength > MAX_IMAGE_BYTES) {
    await response.body?.cancel()
    throw new Error(`Image exceeds ${MAX_IMAGE_BYTES} bytes`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error(`Image exceeds ${MAX_IMAGE_BYTES} bytes`)
  const ext = path.extname(new URL(encodedUrl).pathname) || '.jpg'
  const filename = `${crypto.randomUUID()}${ext}`
  const filePath = path.join(uploadsDir, filename)
  await fs.promises.writeFile(filePath, buffer)
  return `/uploads/${filename}`
}

async function run() {
  const items = await prisma.item.findMany({
    where: {
      image: {
        startsWith: 'http',
      },
    },
  })

  if (!items.length) {
    console.log('No remote image URLs found to migrate.')
    return
  }

  console.log(`Found ${items.length} item(s) with remote images. Migrating...`)

  let failures = 0
  for (const item of items) {
    try {
      const newPath = await downloadToUploads(item.image)
      await prisma.item.update({
        where: { id: item.id },
        data: { image: newPath },
      })
      console.log(`✔ Migrated item ${item.id} -> ${newPath}`)
    } catch (error) {
      failures += 1
      // Log only origin and path: signed URLs carry tokens in the query string
      const source = buildSafeSourceDescriptor(item.image)
      console.error(`✖ Failed to migrate item ${item.id} (${source.origin}${source.pathname}):`, error.message)
    }
  }

  if (failures) throw new Error(`${failures} of ${items.length} image(s) failed to migrate`)
}

run()
  .catch((error) => {
    console.error('Migration failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
