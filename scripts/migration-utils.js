/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')

const PACKAGE_DIR = path.join(process.cwd(), 'migration-package')
const DATA_DIR = path.join(PACKAGE_DIR, 'data')
const UPLOADS_DIR = path.join(PACKAGE_DIR, 'uploads')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function ensurePackageDirs() {
  ensureDir(PACKAGE_DIR)
  ensureDir(DATA_DIR)
  ensureDir(UPLOADS_DIR)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function isMissing(value) {
  return value === null || value === undefined || value === ''
}

function validateRows(tableName, rows, requiredFields) {
  for (const row of rows) {
    for (const field of requiredFields) {
      if (isMissing(row[field])) {
        throw new Error(`${tableName} row ${row.id ?? '(without id)'} missing required field ${field}`)
      }
    }
  }
}

function validateExportRows({ items, orders, itemsOrders }) {
  validateRows('items', items, ['id', 'name', 'image', 'price'])
  validateRows('orders', orders, ['id', 'status'])
  validateRows('items_orders', itemsOrders, ['id', 'order_id', 'item_id', 'quantity'])
}

function safeFilenameFromUrl(imageUrl) {
  let filename = 'image.jpg'

  try {
    const parsed = new URL(imageUrl)
    if (!parsed.pathname.endsWith('/')) {
      filename = parsed.pathname.split('/').pop() || filename
    }
  } catch (_error) {
    filename = imageUrl.split('/').pop() || filename
  }

  try {
    filename = decodeURIComponent(filename)
  } catch (_error) {
    // Keep the original filename if it contains malformed percent escapes.
  }

  return filename.replace(/[\\/]/g, '_') || 'image.jpg'
}

function dedupeFilename(filename, usedFilenames) {
  const extensionStart = filename.lastIndexOf('.')
  const ext = extensionStart > 0 ? filename.slice(extensionStart) : '.jpg'
  const base = extensionStart > 0 ? filename.slice(0, extensionStart) || 'image' : filename || 'image'
  let candidate = `${base}${ext}`
  let suffix = 2

  while (usedFilenames.has(candidate)) {
    candidate = `${base}-${suffix}${ext}`
    suffix += 1
  }

  usedFilenames.add(candidate)
  return candidate
}

function buildLocalImagePath(imageUrl, usedFilenames) {
  const filename = dedupeFilename(safeFilenameFromUrl(imageUrl), usedFilenames)
  return {
    filename,
    localPath: `/uploads/${filename}`,
  }
}

function normalizeSupabaseRow(row) {
  const normalized = {}
  for (const [key, value] of Object.entries(row)) {
    if (key === 'created_at') normalized.createdAt = value
    else if (key === 'order_id') normalized.orderId = value
    else if (key === 'item_id') normalized.itemId = value
    else normalized[key] = value
  }
  return normalized
}

function packagePath(...parts) {
  return path.join(PACKAGE_DIR, ...parts)
}

function appUploadsDir() {
  return path.join(process.cwd(), 'public', 'uploads')
}

module.exports = {
  PACKAGE_DIR,
  DATA_DIR,
  UPLOADS_DIR,
  appUploadsDir,
  buildLocalImagePath,
  ensureDir,
  ensurePackageDirs,
  normalizeSupabaseRow,
  packagePath,
  readJson,
  validateExportRows,
  writeJson,
}
