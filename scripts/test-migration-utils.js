/* eslint-disable no-console */
const assert = require('assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  assertLocalDatabaseUrl,
  buildLocalImagePath,
  listUploadFiles,
  normalizeSupabaseRow,
  validateLocalUploadReferences,
  validateRestoredUploads,
  validateExportRows,
} = require('./migration-utils')

function testBuildLocalImagePathKeepsExtension() {
  const used = new Set()
  const result = buildLocalImagePath(
    'https://example.supabase.co/storage/v1/object/public/images/sunflower.jpg',
    used
  )
  assert.equal(result.filename, 'sunflower.jpg')
  assert.equal(result.localPath, '/uploads/sunflower.jpg')
}

function testBuildLocalImagePathDeduplicatesNames() {
  const used = new Set(['sunflower.jpg'])
  const result = buildLocalImagePath(
    'https://example.supabase.co/storage/v1/object/public/images/sunflower.jpg',
    used
  )
  assert.equal(result.filename, 'sunflower-2.jpg')
  assert.equal(result.localPath, '/uploads/sunflower-2.jpg')
}

function testBuildLocalImagePathSanitizesDecodedSeparators() {
  const used = new Set()
  const result = buildLocalImagePath(
    'https://example.supabase.co/storage/v1/object/public/images/folder%5Csunflower%2Fcup.jpg',
    used
  )
  assert.equal(result.filename, 'folder_sunflower_cup.jpg')
  assert.equal(result.localPath, '/uploads/folder_sunflower_cup.jpg')
}

function testBuildLocalImagePathUsesDeterministicFallback() {
  const used = new Set(['image.jpg'])
  const result = buildLocalImagePath(
    'https://example.supabase.co/storage/v1/object/public/images/',
    used
  )
  assert.equal(result.filename, 'image-2.jpg')
  assert.equal(result.localPath, '/uploads/image-2.jpg')
}

function testNormalizeSupabaseRowMapsSnakeCase() {
  const result = normalizeSupabaseRow({
    id: 1,
    order_id: 2,
    item_id: 3,
    created_at: '2026-05-10T10:00:00.000Z',
    quantity: 4,
  })
  assert.deepEqual(result, {
    id: 1,
    orderId: 2,
    itemId: 3,
    createdAt: '2026-05-10T10:00:00.000Z',
    quantity: 4,
  })
}

function testNormalizeSupabaseRowKeepsItemFields() {
  const result = normalizeSupabaseRow({
    id: 1,
    name: 'Cup',
    image: '/uploads/cup.jpg',
    price: 12.5,
    deleted: false,
    created_at: '2026-05-10T10:00:00.000Z',
  })
  assert.deepEqual(result, {
    id: 1,
    name: 'Cup',
    image: '/uploads/cup.jpg',
    price: 12.5,
    deleted: false,
    createdAt: '2026-05-10T10:00:00.000Z',
  })
}

function testValidateExportRowsRejectsMissingRequiredFields() {
  assert.throws(
    () =>
      validateExportRows({
        items: [{ id: 1, name: null, image: '/uploads/a.jpg', price: 10, deleted: false, created_at: '2026-05-10T10:00:00.000Z' }],
        orders: [{ id: 1, status: 'pending', created_at: '2026-05-10T10:00:00.000Z' }],
        itemsOrders: [{ id: 1, order_id: 1, item_id: 1, quantity: 1, created_at: '2026-05-10T10:00:00.000Z' }],
      }),
    /items row 1 missing required field name/
  )
}

function testValidateExportRowsAcceptsValidRows() {
  assert.doesNotThrow(() =>
    validateExportRows({
      items: [{ id: 1, name: 'Cup', image: '/uploads/cup.jpg', price: 10, deleted: false, created_at: '2026-05-10T10:00:00.000Z' }],
      orders: [{ id: 1, status: 'completed', created_at: '2026-05-10T10:00:00.000Z' }],
      itemsOrders: [{ id: 1, order_id: 1, item_id: 1, quantity: 2, created_at: '2026-05-10T10:00:00.000Z' }],
    })
  )
}

function testAssertLocalDatabaseUrlAcceptsLocalAppDatabase() {
  const result = assertLocalDatabaseUrl('postgresql://user:pass@localhost:5432/sunflower_crafts_pos')
  assert.equal(result, 'postgresql://user:pass@localhost:5432/sunflower_crafts_pos')
}

function testAssertLocalDatabaseUrlAcceptsIpv6LocalAppDatabase() {
  const result = assertLocalDatabaseUrl('postgresql://user:pass@[::1]:5432/sunflower_crafts_pos')
  assert.equal(result, 'postgresql://user:pass@[::1]:5432/sunflower_crafts_pos')
}

function testAssertLocalDatabaseUrlRejectsRemoteHost() {
  assert.throws(
    () => assertLocalDatabaseUrl('postgresql://user:pass@example.com:5432/sunflower_crafts_pos'),
    /DATABASE_URL must point to a local database host/
  )
}

function testAssertLocalDatabaseUrlRejectsWrongDatabaseName() {
  assert.throws(
    () => assertLocalDatabaseUrl('postgresql://user:pass@localhost:5432/postgres'),
    /DATABASE_URL database name must be sunflower_crafts_pos/
  )
}

function testAssertLocalDatabaseUrlRejectsHostQueryOverride() {
  assert.throws(
    () => assertLocalDatabaseUrl('postgresql://user:pass@localhost:5432/sunflower_crafts_pos?host=example.com'),
    /DATABASE_URL must not include unsafe PostgreSQL query parameter: host/
  )
}

function withTempDir(callback) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-utils-'))
  try {
    callback(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function testListUploadFilesAcceptsRegularFiles() {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'cup.jpg'), '')
    assert.deepEqual(listUploadFiles(dir), ['cup.jpg'])
  })
}

function testListUploadFilesRejectsDirectories() {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, 'nested'))
    assert.throws(() => listUploadFiles(dir), /Migration upload entry must be a regular file/)
  })
}

function testListUploadFilesRejectsSymlinks() {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'cup.jpg'), '')
    fs.symlinkSync(path.join(dir, 'cup.jpg'), path.join(dir, 'cup-link.jpg'))
    assert.throws(() => listUploadFiles(dir), /Migration upload entry must be a regular file/)
  })
}

function testValidateLocalUploadReferencesAcceptsExistingUploadReferences() {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'cup.jpg'), '')
    assert.doesNotThrow(() => validateLocalUploadReferences([{ id: 1, image: '/uploads/cup.jpg' }], dir))
  })
}

function testValidateLocalUploadReferencesIgnoresNonUploadReferences() {
  withTempDir((dir) => {
    assert.doesNotThrow(() => validateLocalUploadReferences([{ id: 1, image: 'https://example.com/cup.jpg' }], dir))
  })
}

function testValidateLocalUploadReferencesRejectsMissingUploadReferences() {
  withTempDir((dir) => {
    assert.throws(
      () => validateLocalUploadReferences([{ id: 1, image: '/uploads/missing.jpg' }], dir),
      /Item 1 references missing restored upload: \/uploads\/missing\.jpg/
    )
  })
}

function testValidateRestoredUploadsRejectsManifestCountMismatch() {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'cup.jpg'), '')
    assert.throws(
      () => validateRestoredUploads({ items: [{ id: 1, image: '/uploads/cup.jpg' }], uploadsDir: dir, copiedImages: 1, manifest: { counts: { images: 2 } } }),
      /Restored image count does not match manifest count/
    )
  })
}

testBuildLocalImagePathKeepsExtension()
testBuildLocalImagePathDeduplicatesNames()
testBuildLocalImagePathSanitizesDecodedSeparators()
testBuildLocalImagePathUsesDeterministicFallback()
testNormalizeSupabaseRowMapsSnakeCase()
testNormalizeSupabaseRowKeepsItemFields()
testValidateExportRowsRejectsMissingRequiredFields()
testValidateExportRowsAcceptsValidRows()
testAssertLocalDatabaseUrlAcceptsLocalAppDatabase()
testAssertLocalDatabaseUrlAcceptsIpv6LocalAppDatabase()
testAssertLocalDatabaseUrlRejectsRemoteHost()
testAssertLocalDatabaseUrlRejectsWrongDatabaseName()
testAssertLocalDatabaseUrlRejectsHostQueryOverride()
testListUploadFilesAcceptsRegularFiles()
testListUploadFilesRejectsDirectories()
testListUploadFilesRejectsSymlinks()
testValidateLocalUploadReferencesAcceptsExistingUploadReferences()
testValidateLocalUploadReferencesIgnoresNonUploadReferences()
testValidateLocalUploadReferencesRejectsMissingUploadReferences()
testValidateRestoredUploadsRejectsManifestCountMismatch()

console.log('migration-utils tests passed')
