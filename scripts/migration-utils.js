/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')

const PACKAGE_DIR = path.join(process.cwd(), 'migration-package')
const DATA_DIR = path.join(PACKAGE_DIR, 'data')
const UPLOADS_DIR = path.join(PACKAGE_DIR, 'uploads')
const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const UNSAFE_DATABASE_URL_QUERY_PARAMS = new Set(['host', 'port', 'socket', 'sslmode'])

// Runs the Prisma CLI with this Node binary. Spawning `npx` fails on Windows (npx.cmd
// can't be spawned without a shell), so this works the same on every platform.
function runPrisma(args, options = {}) {
  const { execFileSync } = require('child_process')
  return execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], options)
}

// On Windows, antivirus scanners and the indexer briefly lock files that were just
// written, so renaming or deleting a fresh folder can fail with EPERM/EBUSY. Retry
// for a few seconds before giving up.
const TRANSIENT_FS_ERRORS = new Set(['EPERM', 'EBUSY', 'EACCES', 'ENOTEMPTY'])

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function renameWithRetry(from, to, attempts = 15) {
  for (let attempt = 1; ; attempt++) {
    try {
      return fs.renameSync(from, to)
    } catch (error) {
      if (!TRANSIENT_FS_ERRORS.has(error.code) || attempt >= attempts) throw error
      sleepSync(Math.min(100 * attempt, 500))
    }
  }
}

function removePath(target) {
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function ensurePackageDirs() {
  ensureDir(PACKAGE_DIR)
  ensureDir(DATA_DIR)
  ensureDir(UPLOADS_DIR)
}

// Start every export/build from an empty package so leftovers from an earlier
// run can't end up in uploads/ or skew the image count
function resetPackageDirs(packageDir = PACKAGE_DIR) {
  removePath(path.join(packageDir, 'data'))
  removePath(path.join(packageDir, 'uploads'))
  removePath(path.join(packageDir, 'manifest.json'))
  ensureDir(path.join(packageDir, 'data'))
  ensureDir(path.join(packageDir, 'uploads'))
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

function validateNumbers(tableName, rows, fields) {
  for (const row of rows) {
    for (const field of fields) {
      if (isMissing(row[field])) continue
      if (typeof row[field] !== 'number' || !Number.isFinite(row[field])) {
        throw new Error(`${tableName} row ${row.id ?? '(without id)'} field ${field} must be a number`)
      }
    }
  }
}

function validateUniqueIds(tableName, rows) {
  const seen = new Set()
  for (const row of rows) {
    if (seen.has(row.id)) throw new Error(`${tableName} has duplicate id ${row.id}`)
    seen.add(row.id)
  }
}

function validateExportRows({ items, orders, itemsOrders }) {
  validateRows('items', items, ['id', 'name', 'image', 'price'])
  validateRows('orders', orders, ['id', 'status'])
  validateRows('items_orders', itemsOrders, ['id', 'order_id', 'item_id', 'quantity'])
  validateNumbers('items', items, ['id', 'price'])
  validateNumbers('orders', orders, ['id'])
  validateNumbers('items_orders', itemsOrders, ['id', 'order_id', 'item_id', 'quantity', 'unit_price'])
  validateUniqueIds('items', items)
  validateUniqueIds('orders', orders)
  validateUniqueIds('items_orders', itemsOrders)

  // Catch problems before the onsite restore instead of as a foreign key error there
  const itemIds = new Set(items.map((item) => item.id))
  const orderIds = new Set(orders.map((order) => order.id))
  const pairs = new Set()
  for (const row of itemsOrders) {
    if (!orderIds.has(row.order_id)) {
      throw new Error(`items_orders row ${row.id} references missing order ${row.order_id}`)
    }
    if (!itemIds.has(row.item_id)) {
      throw new Error(`items_orders row ${row.id} references missing item ${row.item_id}`)
    }
    const pair = `${row.order_id}:${row.item_id}`
    if (pairs.has(pair)) {
      throw new Error(`items_orders has more than one row for order ${row.order_id} and item ${row.item_id}`)
    }
    pairs.add(pair)
  }
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

  let databasePath
  try {
    databasePath = decodeURIComponent(databaseUrl.pathname)
  } catch (_error) {
    throw new Error('DATABASE_URL database name must be sunflower_crafts_pos')
  }

  if (databasePath !== '/sunflower_crafts_pos') {
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

  // Also replace characters Windows rejects in filenames or that break /uploads/ URLs
  const safe = filename
    .replace(/[\\/]/g, '_')
    .replace(/[<>:"|?*#%\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/, '')
  return safe || 'image.jpg'
}

function dedupeFilename(filename, usedFilenames) {
  const extensionStart = filename.lastIndexOf('.')
  const ext = extensionStart > 0 ? filename.slice(extensionStart) : '.jpg'
  const base = extensionStart > 0 ? filename.slice(0, extensionStart) || 'image' : filename || 'image'
  let candidate = `${base}${ext}`
  let suffix = 2

  // Windows filenames are case-insensitive, so Cup.jpg and cup.jpg would collide there
  while (usedFilenames.has(candidate.toLowerCase())) {
    candidate = `${base}-${suffix}${ext}`
    suffix += 1
  }

  usedFilenames.add(candidate.toLowerCase())
  return candidate
}

function buildLocalImagePath(imageUrl, usedFilenames) {
  const filename = dedupeFilename(safeFilenameFromUrl(imageUrl), usedFilenames)
  return {
    filename,
    localPath: `/uploads/${filename}`,
  }
}

function buildSafeSourceDescriptor(imageUrl) {
  try {
    const parsed = new URL(encodeURI(imageUrl))
    return {
      origin: parsed.origin,
      pathname: parsed.pathname,
    }
  } catch (_error) {
    return {
      origin: null,
      pathname: 'unparseable image URL',
    }
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

// Same lookup as src/lib/storage.ts
function appUploadsDir() {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(process.cwd(), 'public', 'uploads')
}

// Files the OS drops into folders on its own (Explorer thumbnails, Finder metadata)
function isSystemJunkFile(filename) {
  return filename.startsWith('.') || /^(thumbs\.db|desktop\.ini)$/i.test(filename)
}

function listUploadFiles(uploadsDir) {
  const filenames = fs.readdirSync(uploadsDir).filter((filename) => !isSystemJunkFile(filename)).sort()
  for (const filename of filenames) {
    const filePath = path.join(uploadsDir, filename)
    if (!fs.lstatSync(filePath).isFile()) {
      throw new Error(`Migration upload entry must be a regular file: ${filePath}`)
    }
  }
  return filenames
}

/** Items whose /uploads/ image has no matching file in uploadsDir. */
function missingUploadReferences(items, uploadsDir) {
  const uploadsRoot = path.resolve(uploadsDir)
  const uploadsRootPrefix = `${uploadsRoot}${path.sep}`

  return items.filter((item) => {
    if (typeof item.image !== 'string' || !item.image.startsWith('/uploads/')) return false

    const relativePath = item.image.slice('/uploads/'.length)
    const uploadPath = path.resolve(uploadsDir, relativePath)

    return !relativePath || !uploadPath.startsWith(uploadsRootPrefix) || !fs.existsSync(uploadPath) || !fs.lstatSync(uploadPath).isFile()
  })
}

// knownMissing: images the package already records as missing (a backup taken while an
// item's photo was gone); those are accepted, anything else missing is an error
function validateLocalUploadReferences(items, uploadsDir, knownMissing = []) {
  const accepted = new Set(knownMissing)
  for (const item of missingUploadReferences(items, uploadsDir)) {
    if (accepted.has(item.image)) continue
    throw new Error(`Item ${item.id ?? '(without id)'} references missing restored upload: ${item.image}`)
  }
}

function validateRestoredUploads({ items, uploadsDir, copiedImages, manifest }) {
  validateLocalUploadReferences(items, uploadsDir, manifest.missingImages ?? [])

  if (copiedImages !== manifest.counts.images) {
    throw new Error('Restored image count does not match manifest count')
  }
}

function copyUploadFiles(sourceDir, targetDir) {
  const filenames = listUploadFiles(sourceDir)
  ensureDir(targetDir)
  for (const filename of filenames) {
    fs.copyFileSync(path.join(sourceDir, filename), path.join(targetDir, filename))
  }
  return filenames.length
}

/**
 * Copies uploads into a temp folder next to targetDir without touching targetDir.
 * Call commit() to swap it in (after the database restore succeeded) or discard()
 * to leave the current uploads untouched.
 */
function stageUploads(sourceDir, targetDir) {
  const parentDir = path.dirname(targetDir)
  const targetName = path.basename(targetDir)
  const suffix = `${process.pid}-${Date.now()}`
  const stagedDir = path.join(parentDir, `.${targetName}.tmp-${suffix}`)
  const backupDir = path.join(parentDir, `.${targetName}.backup-${suffix}`)

  ensureDir(parentDir)
  let count
  try {
    count = copyUploadFiles(sourceDir, stagedDir)
  } catch (error) {
    removePath(stagedDir)
    throw error
  }

  return {
    dir: stagedDir,
    count,
    discard() {
      removePath(stagedDir)
    },
    commit() {
      let movedExistingTarget = false
      try {
        if (fs.existsSync(targetDir)) {
          renameWithRetry(targetDir, backupDir)
          movedExistingTarget = true
        }
        renameWithRetry(stagedDir, targetDir)
      } catch (error) {
        if (movedExistingTarget && !fs.existsSync(targetDir) && fs.existsSync(backupDir)) {
          renameWithRetry(backupDir, targetDir)
        }
        throw error
      }
      removePath(backupDir)
    },
  }
}

function copyUploadsAtomically(sourceDir, targetDir) {
  const staged = stageUploads(sourceDir, targetDir)
  try {
    staged.commit()
  } catch (error) {
    staged.discard()
    throw error
  }
  return staged.count
}

module.exports = {
  PACKAGE_DIR,
  DATA_DIR,
  UPLOADS_DIR,
  appUploadsDir,
  assertLocalDatabaseUrl,
  buildLocalImagePath,
  buildSafeSourceDescriptor,
  copyUploadFiles,
  copyUploadsAtomically,
  ensureDir,
  ensurePackageDirs,
  isSystemJunkFile,
  listUploadFiles,
  missingUploadReferences,
  normalizeSupabaseRow,
  packagePath,
  readJson,
  removePath,
  renameWithRetry,
  resetPackageDirs,
  runPrisma,
  stageUploads,
  validateExportRows,
  validateLocalUploadReferences,
  validateRestoredUploads,
  writeJson,
}
