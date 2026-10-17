/* eslint-disable no-console */
/**
 * build-migration-package.js
 *
 * Reads the three SQL DML files downloaded from Supabase dashboard and a flat
 * folder of downloaded images, then produces the migration-package/ structure
 * that restore-local-postgres.js expects:
 *
 *   migration-package/
 *     data/
 *       items.json
 *       orders.json
 *       items_orders.json
 *     uploads/           ← images copied here
 *     manifest.json
 *
 * Usage:
 *   node scripts/build-migration-package.js \
 *     --sql-dir /path/to/sql-folder \
 *     --images-dir /path/to/images-folder
 *
 * The sql-dir must contain:
 *   items_rows.sql
 *   orders_rows.sql
 *   items_orders_rows.sql
 *
 * The images-dir must be a flat folder of image files whose names match the
 * last path segment of the Supabase image URLs stored in items_rows.sql.
 *
 * The build stops if an item's image is missing. Pass --allow-missing-images to
 * build anyway; the restore will then fail until the files are added to
 * migration-package/uploads/.
 */

const fs = require('fs')
const path = require('path')

const {
  DATA_DIR,
  UPLOADS_DIR,
  buildLocalImagePath,
  buildSafeSourceDescriptor,
  listUploadFiles,
  packagePath,
  resetPackageDirs,
  validateExportRows,
  writeJson,
} = require('./migration-utils')

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2)
  const result = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sql-dir') result.sqlDir = args[++i]
    else if (args[i] === '--images-dir') result.imagesDir = args[++i]
    else if (args[i] === '--allow-missing-images') result.allowMissingImages = true
  }
  if (!result.sqlDir) throw new Error('Missing --sql-dir argument')
  if (!result.imagesDir) throw new Error('Missing --images-dir argument')
  return result
}

// ---------------------------------------------------------------------------
// SQL parser
// Handles the Supabase dashboard export format:
//   INSERT INTO "public"."table" ("col1", "col2", ...) VALUES (...), (...);
// A file may contain several INSERT statements; all of them are read.
// ---------------------------------------------------------------------------

const INSERT_HEADER = /INSERT INTO [^(]+\(([^)]+)\)\s+VALUES/gi

/**
 * Parse the value tuples of one VALUES (...), (...), ...; section starting at `start`.
 * Returns the tuples and the index just past the statement.
 */
function parseValueTuples(sql, start) {
  const valueSection = sql.slice(start)

  const rows = []
  let i = 0

  while (i < valueSection.length) {
    // Skip whitespace and commas between tuples
    while (i < valueSection.length && /[,\s]/.test(valueSection[i])) i++
    if (i >= valueSection.length) break
    if (valueSection[i] === ';') {
      i++
      break
    }
    if (valueSection[i] !== '(') throw new Error(`Expected '(' at position ${i}, got '${valueSection[i]}'`)
    i++ // skip '('

    const fields = []
    while (i < valueSection.length && valueSection[i] !== ')') {
      // Skip leading whitespace
      while (i < valueSection.length && /\s/.test(valueSection[i])) i++

      if (valueSection[i] === "'") {
        // Quoted string — handle escaped single quotes ('')
        i++ // skip opening quote
        let str = ''
        while (i < valueSection.length) {
          if (valueSection[i] === "'" && valueSection[i + 1] === "'") {
            str += "'"
            i += 2
          } else if (valueSection[i] === "'") {
            i++ // skip closing quote
            break
          } else {
            str += valueSection[i++]
          }
        }
        fields.push(str)
      } else {
        // Unquoted token: number, boolean, or NULL
        let token = ''
        while (i < valueSection.length && valueSection[i] !== ',' && valueSection[i] !== ')') {
          token += valueSection[i++]
        }
        token = token.trim()
        if (token.toUpperCase() === 'NULL') fields.push(null)
        else if (token.toLowerCase() === 'true') fields.push(true)
        else if (token.toLowerCase() === 'false') fields.push(false)
        else if (!isNaN(Number(token))) fields.push(Number(token))
        else fields.push(token)
      }

      // Skip trailing whitespace then optional comma between fields
      while (i < valueSection.length && /\s/.test(valueSection[i])) i++
      if (valueSection[i] === ',') i++
    }
    i++ // skip closing ')'
    rows.push(fields)
  }

  return { rows, end: start + i }
}

// The dashboard may quote every value ('1', 'false'), so convert by column, not by quoting
const NUMBER_COLUMNS = new Set(['id', 'price', 'quantity', 'order_id', 'item_id', 'unit_price'])
const BOOLEAN_COLUMNS = new Set(['deleted'])

function coerceValue(column, value) {
  if (value === null || value === undefined) return value
  if (NUMBER_COLUMNS.has(column)) {
    const number = typeof value === 'number' ? value : Number(String(value).trim())
    if (String(value).trim() === '' || !Number.isFinite(number)) {
      throw new Error(`Column ${column} has a non-numeric value: ${value}`)
    }
    return number
  }
  if (BOOLEAN_COLUMNS.has(column)) {
    if (typeof value === 'boolean') return value
    const text = String(value).trim().toLowerCase()
    if (['true', 't', '1'].includes(text)) return true
    if (['false', 'f', '0'].includes(text)) return false
    throw new Error(`Column ${column} has a non-boolean value: ${value}`)
  }
  return value
}

function parseSqlText(sql) {
  const rows = []
  INSERT_HEADER.lastIndex = 0
  let header
  while ((header = INSERT_HEADER.exec(sql))) {
    const columns = header[1].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const { rows: tuples, end } = parseValueTuples(sql, INSERT_HEADER.lastIndex)
    for (const fields of tuples) {
      if (fields.length !== columns.length) {
        throw new Error(`Expected ${columns.length} values per row, found ${fields.length}`)
      }
      const row = {}
      columns.forEach((col, idx) => { row[col] = coerceValue(col, fields[idx]) })
      rows.push(row)
    }
    INSERT_HEADER.lastIndex = end
  }
  if (!rows.length && /INSERT INTO/i.test(sql)) throw new Error('Could not parse column names from SQL')
  return rows
}

function parseSql(filePath) {
  return parseSqlText(fs.readFileSync(filePath, 'utf8'))
}

// ---------------------------------------------------------------------------
// Image resolution
// ---------------------------------------------------------------------------

/**
 * Build a map from Supabase filename → local file path.
 * Supabase image URLs end with the original filename (URL-encoded).
 * The downloaded files preserve that filename.
 */
function buildImageIndex(imagesDir) {
  const files = fs.readdirSync(imagesDir)
  const index = new Map()
  for (const file of files) {
    const fullPath = path.join(imagesDir, file)
    if (fs.lstatSync(fullPath).isFile()) {
      // Index by exact filename and by URL-decoded filename
      index.set(file, fullPath)
      try { index.set(decodeURIComponent(file), fullPath) } catch (_) {}
    }
  }
  return index
}

function resolveImageFile(imageUrl, imageIndex) {
  if (!imageUrl) return null
  let filename
  try {
    filename = decodeURIComponent(new URL(imageUrl).pathname.split('/').pop())
  } catch (_) {
    filename = imageUrl.split('/').pop()
  }
  return imageIndex.get(filename) || imageIndex.get(encodeURIComponent(filename)) || null
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run() {
  const { sqlDir, imagesDir, allowMissingImages } = parseArgs()

  console.log('Building migration package...')
  console.log(`  SQL dir:    ${sqlDir}`)
  console.log(`  Images dir: ${imagesDir}`)

  // Parse SQL files
  const itemsRaw = parseSql(path.join(sqlDir, 'items_rows.sql'))
  const ordersRaw = parseSql(path.join(sqlDir, 'orders_rows.sql'))
  const itemsOrdersRaw = parseSql(path.join(sqlDir, 'items_orders_rows.sql'))

  console.log(`Parsed: ${itemsRaw.length} items, ${ordersRaw.length} orders, ${itemsOrdersRaw.length} items_orders`)

  validateExportRows({ items: itemsRaw, orders: ordersRaw, itemsOrders: itemsOrdersRaw })

  const imageIndexCheck = buildImageIndex(imagesDir)
  const missing = itemsRaw.filter((row) => !resolveImageFile(row.image, imageIndexCheck))
  if (missing.length && !allowMissingImages) {
    for (const row of missing) console.error(`  Missing image for item ${row.id}: ${row.image}`)
    throw new Error(`${missing.length} item image(s) not found in ${imagesDir} (use --allow-missing-images to build anyway)`)
  }

  resetPackageDirs()

  // Build image index from downloaded files
  const imageIndex = buildImageIndex(imagesDir)

  // Process items: resolve images, copy files, rewrite image paths
  const usedFilenames = new Set()
  const imageManifestEntries = []
  let missingImages = 0

  const items = itemsRaw.map((row) => {
    const srcPath = resolveImageFile(row.image, imageIndex)

    if (!srcPath) {
      console.warn(`  WARNING: No local file found for item ${row.id} image: ${row.image}`)
      missingImages++
      // Use a placeholder path so restore can still run; operator must fix manually
      const { localPath } = buildLocalImagePath(row.image, usedFilenames)
      return { ...row, image: localPath }
    }

    const { filename, localPath } = buildLocalImagePath(row.image, usedFilenames)
    const destPath = path.join(UPLOADS_DIR, filename)
    fs.copyFileSync(srcPath, destPath)

    imageManifestEntries.push({
      itemId: row.id,
      filename,
      source: buildSafeSourceDescriptor(row.image),
    })

    return { ...row, image: localPath }
  })

  // Write JSON files
  writeJson(path.join(DATA_DIR, 'items.json'), items)
  writeJson(path.join(DATA_DIR, 'orders.json'), ordersRaw)
  writeJson(path.join(DATA_DIR, 'items_orders.json'), itemsOrdersRaw)

  // Count actual files copied to uploads dir
  const copiedImages = listUploadFiles(UPLOADS_DIR).length

  // Write manifest
  const manifest = {
    exportedAt: new Date().toISOString(),
    builtBy: 'build-migration-package.js',
    counts: {
      items: items.length,
      orders: ordersRaw.length,
      itemsOrders: itemsOrdersRaw.length,
      images: copiedImages,
    },
    images: imageManifestEntries,
  }
  writeJson(packagePath('manifest.json'), manifest)

  console.log('\nMigration package built successfully.')
  console.log(`  Items:        ${items.length}`)
  console.log(`  Orders:       ${ordersRaw.length}`)
  console.log(`  Items/orders: ${itemsOrdersRaw.length}`)
  console.log(`  Images:       ${copiedImages}`)
  if (missingImages > 0) {
    console.warn(`\n  WARNING: ${missingImages} item(s) had no matching image file.`)
    console.warn('  Check the items.json for image paths and supply the missing files in migration-package/uploads/ before running restore.')
  }
  console.log(`\nOutput: ${path.resolve('migration-package')}`)
}

if (require.main === module) {
  try {
    run()
  } catch (err) {
    console.error('Build failed:', err.message)
    process.exit(1)
  }
}

module.exports = { parseSqlText, coerceValue }
