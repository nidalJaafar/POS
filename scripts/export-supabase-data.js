/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const {
  DATA_DIR,
  UPLOADS_DIR,
  buildLocalImagePath,
  ensurePackageDirs,
  packagePath,
  validateExportRows,
  writeJson,
} = require('./migration-utils')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_API_KEY

if (!supabaseUrl) throw new Error('SUPABASE_URL is not set')
if (!supabaseKey) throw new Error('SUPABASE_API_KEY is not set')

function headers() {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
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
  const response = await fetch(encodedUrl, { headers: imageUrl.startsWith(supabaseUrl) ? headers() : undefined })
  if (!response.ok) {
    throw new Error(`Failed to download ${encodedUrl}: ${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
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
      imageMappings.push({ itemId: item.id, source, filename, localPath })
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
    exportedAt: new Date().toISOString(),
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
