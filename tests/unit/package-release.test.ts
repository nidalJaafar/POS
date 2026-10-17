import path from 'path'
import { describe, expect, it } from 'vitest'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { shouldCopy } = require('../../scripts/package-release.js')

const at = (relative: string) => path.join(process.cwd(), ...relative.split('/'))

describe('what goes into a release', () => {
  it.each([
    'public/icons/logo-192.png',
    'prisma/migrations/20261017120000_add_unit_price_to_items_orders/migration.sql',
    'scripts/backup.js',
    'node_modules/next/dist/bin/next',
    'node_modules/prisma/build/index.js',
    'node_modules/@img/sharp-win32-x64/lib/sharp.node',
    'node_modules/usb/prebuilds/win32-x64/node.napi.node',
  ])('includes %s', (file) => {
    expect(shouldCopy(at(file))).toBe(true)
  })

  it.each([
    // The shop's own data
    'public/uploads',
    'public/uploads/photo.jpg',
    // Build caches and build-only tools
    '.next/cache/images/x',
    'node_modules/.cache/x',
    'node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node',
    'node_modules/typescript/lib/typescript.js',
    'node_modules/@playwright/test/index.js',
    'node_modules/playwright-core/index.js',
    // Development-only scripts
    'scripts/test-db.js',
    'scripts/seed.js',
    'scripts/package-release.js',
  ])('leaves out %s', (file) => {
    expect(shouldCopy(at(file))).toBe(false)
  })

  it('leaves out the cache of a build folder with another name', () => {
    expect(shouldCopy(at('.next-e2e/cache/x'), '.next-e2e')).toBe(false)
    expect(shouldCopy(at('.next-e2e/server/app.js'), '.next-e2e')).toBe(true)
  })
})
