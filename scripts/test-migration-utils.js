/* eslint-disable no-console */
const assert = require('assert/strict')

const {
  buildLocalImagePath,
  normalizeSupabaseRow,
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

testBuildLocalImagePathKeepsExtension()
testBuildLocalImagePathDeduplicatesNames()
testBuildLocalImagePathSanitizesDecodedSeparators()
testBuildLocalImagePathUsesDeterministicFallback()
testNormalizeSupabaseRowMapsSnakeCase()
testNormalizeSupabaseRowKeepsItemFields()
testValidateExportRowsRejectsMissingRequiredFields()
testValidateExportRowsAcceptsValidRows()

console.log('migration-utils tests passed')
