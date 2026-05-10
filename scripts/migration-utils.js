/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')

const PACKAGE_DIR = path.join(process.cwd(), 'migration-package')
const DATA_DIR = path.join(PACKAGE_DIR, 'data')
const UPLOADS_DIR = path.join(PACKAGE_DIR, 'uploads')
const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const UNSAFE_DATABASE_URL_QUERY_PARAMS = new Set(['host', 'port', 'socket', 'sslmode'])

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

function assertLocalDatabaseUrl(connectionString) {
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  let databaseUrl
  try {
    databaseUrl = new URL(connectionString)
  } catch (_error) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL')
  }

  const hostname = databaseUrl.hostname.replace(/^\[(.*)]$/, '$1')

  for (const key of databaseUrl.searchParams.keys()) {
    if (UNSAFE_DATABASE_URL_QUERY_PARAMS.has(key.toLowerCase())) {
      throw new Error(`DATABASE_URL must not include unsafe PostgreSQL query parameter: ${key}`)
    }
  }

  if (!LOCAL_DATABASE_HOSTS.has(hostname)) {
    throw new Error('DATABASE_URL must point to a local database host')
  }

  if (!databaseUrl.pathname.endsWith('/sunflower_crafts_pos')) {
    throw new Error('DATABASE_URL database name must be sunflower_crafts_pos')
  }

  return connectionString
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

function listUploadFiles(uploadsDir) {
  const filenames = fs.readdirSync(uploadsDir).sort()
  for (const filename of filenames) {
    const filePath = path.join(uploadsDir, filename)
    if (!fs.lstatSync(filePath).isFile()) {
      throw new Error(`Migration upload entry must be a regular file: ${filePath}`)
    }
  }
  return filenames
}

function validateLocalUploadReferences(items, uploadsDir) {
  const uploadsRoot = path.resolve(uploadsDir)
  const uploadsRootPrefix = `${uploadsRoot}${path.sep}`

  for (const item of items) {
    if (typeof item.image !== 'string' || !item.image.startsWith('/uploads/')) continue

    const relativePath = item.image.slice('/uploads/'.length)
    const uploadPath = path.resolve(uploadsDir, relativePath)

    if (!relativePath || !uploadPath.startsWith(uploadsRootPrefix) || !fs.existsSync(uploadPath) || !fs.lstatSync(uploadPath).isFile()) {
      throw new Error(`Item ${item.id ?? '(without id)'} references missing restored upload: ${item.image}`)
    }
  }
}

function copyUploadsAtomically(sourceDir, targetDir) {
  const filenames = listUploadFiles(sourceDir)
  const parentDir = path.dirname(targetDir)
  const targetName = path.basename(targetDir)
  const suffix = `${process.pid}-${Date.now()}`
  const tempDir = path.join(parentDir, `.${targetName}.tmp-${suffix}`)
  const backupDir = path.join(parentDir, `.${targetName}.backup-${suffix}`)
  let movedExistingTarget = false

  ensureDir(parentDir)

  try {
    ensureDir(tempDir)
    for (const filename of filenames) {
      fs.copyFileSync(path.join(sourceDir, filename), path.join(tempDir, filename))
    }

    if (fs.existsSync(targetDir)) {
      fs.renameSync(targetDir, backupDir)
      movedExistingTarget = true
    }

    fs.renameSync(tempDir, targetDir)
    fs.rmSync(backupDir, { recursive: true, force: true })
    return filenames.length
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true })
    if (movedExistingTarget && !fs.existsSync(targetDir) && fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, targetDir)
    }
    throw error
  }
}

module.exports = {
  PACKAGE_DIR,
  DATA_DIR,
  UPLOADS_DIR,
  appUploadsDir,
  assertLocalDatabaseUrl,
  buildLocalImagePath,
  copyUploadsAtomically,
  ensureDir,
  ensurePackageDirs,
  listUploadFiles,
  normalizeSupabaseRow,
  packagePath,
  readJson,
  validateExportRows,
  validateLocalUploadReferences,
  writeJson,
}
