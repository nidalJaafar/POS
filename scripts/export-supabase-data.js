/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const {
  DATA_DIR,
  UPLOADS_DIR,
  buildLocalImagePath,
  buildSafeSourceDescriptor,
  ensurePackageDirs,
  packagePath,
  validateExportRows,
  writeJson,
} = require('./migration-utils')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_API_KEY
const MAX_IMAGE_BYTES = 25 * 1024 * 1024

if (!supabaseUrl) throw new Error('SUPABASE_URL is not set')
if (!supabaseKey) throw new Error('SUPABASE_API_KEY is not set')

const supabaseOrigin = new URL(supabaseUrl).origin

function headers() {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  }
}

function isSupabaseUrl(imageUrl) {
  return new URL(encodeURI(imageUrl)).origin === supabaseOrigin
}

function safeUrlContext(imageUrl) {
  try {
    return new URL(encodeURI(imageUrl)).origin
  } catch (_error) {
    return 'unparseable image URL'
  }
}

async function fetchTable(tableName) {
  const allRows = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const to = from + pageSize - 1
    const url = `${supabaseUrl}/rest/v1/${tableName}?select=*&order=id.asc`
    const response = await fetch(url, {
      headers: {
        ...headers(),
        Range: `${from}-${to}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch ${tableName}: ${response.status} ${response.statusText} - ${await response.text()}`)
    }

    const rows = await response.json()
    allRows.push(...rows)
    if (rows.length < pageSize) return allRows
    from += pageSize
  }
}

async function downloadImage(imageUrl, filename) {
  const encodedUrl = encodeURI(imageUrl)
  const response = await fetch(encodedUrl, { headers: isSupabaseUrl(imageUrl) ? headers() : undefined })
  const urlContext = safeUrlContext(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download from ${urlContext}: ${response.status} ${response.statusText}`)
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
    await response.body?.cancel()
    throw new Error(`Image from ${urlContext} exceeds ${MAX_IMAGE_BYTES} bytes`)
  }

  const reader = response.body.getReader()
  const chunks = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    totalBytes += value.length
    if (totalBytes > MAX_IMAGE_BYTES) {
      if (reader.cancel) await reader.cancel()
      throw new Error(`Image from ${urlContext} exceeds ${MAX_IMAGE_BYTES} bytes`)
    }

    chunks.push(Buffer.from(value))
  }

  const buffer = Buffer.concat(chunks, totalBytes)
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer)
}

async function run() {
  ensurePackageDirs()

  console.log('Exporting Supabase tables...')
  const [items, orders, itemsOrders] = await Promise.all([
    fetchTable('items'),
    fetchTable('orders'),
    fetchTable('items_orders'),
  ])

  validateExportRows({ items, orders, itemsOrders })

  console.log(`Fetched ${items.length} items, ${orders.length} orders, ${itemsOrders.length} order items.`)

  const usedFilenames = new Set()
  const imageMappings = []
  const warnings = []
  const migratedItems = []

  for (const item of items) {
    const source = item.image
    const { filename, localPath } = buildLocalImagePath(source, usedFilenames)

    try {
      await downloadImage(source, filename)
      imageMappings.push({ itemId: item.id, source: buildSafeSourceDescriptor(source), filename, localPath })
      migratedItems.push({ ...item, image: localPath })
      console.log(`Downloaded image for item ${item.id}: ${localPath}`)
    } catch (error) {
      warnings.push(`Item ${item.id} image failed: ${error.message}`)
      throw new Error(`Image export failed for item ${item.id}: ${error.message}`)
    }
  }

  writeJson(path.join(DATA_DIR, 'items.json'), migratedItems)
  writeJson(path.join(DATA_DIR, 'orders.json'), orders)
  writeJson(path.join(DATA_DIR, 'items_orders.json'), itemsOrders)
  writeJson(packagePath('manifest.json'), {
    exportedAt: process.env.MIGRATION_EXPORTED_AT || new Date().toISOString(),
    supabaseUrl,
    counts: {
      items: migratedItems.length,
      orders: orders.length,
      itemsOrders: itemsOrders.length,
      images: imageMappings.length,
    },
    warnings,
    imageMappings,
  })

  console.log('Export complete: migration-package')
}

run().catch((error) => {
  console.error('Export failed:', error.message)
  process.exit(1)
})
