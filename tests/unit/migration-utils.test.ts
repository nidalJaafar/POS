import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const utils = require('../../scripts/migration-utils.js')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseSqlText, coerceValue } = require('../../scripts/build-migration-package.js')

const tempDirs: string[] = []
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sunflower-migration-'))
  tempDirs.push(dir)
  return dir
}
afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true })
})

const validRows = () => ({
  items: [{ id: 1, name: 'Cup', image: '/uploads/cup.jpg', price: 10 }],
  orders: [{ id: 1, status: 'completed' }],
  itemsOrders: [{ id: 1, order_id: 1, item_id: 1, quantity: 2 }],
})

describe('validateExportRows', () => {
  it('accepts consistent rows', () => {
    expect(() => utils.validateExportRows(validRows())).not.toThrow()
  })

  it('rejects order lines pointing at a missing order', () => {
    const rows = validRows()
    rows.itemsOrders[0].order_id = 99
    expect(() => utils.validateExportRows(rows)).toThrow(/references missing order 99/)
  })

  it('rejects order lines pointing at a missing item', () => {
    const rows = validRows()
    rows.itemsOrders[0].item_id = 42
    expect(() => utils.validateExportRows(rows)).toThrow(/references missing item 42/)
  })

  it('rejects the same item twice in one order', () => {
    const rows = validRows()
    rows.itemsOrders.push({ id: 2, order_id: 1, item_id: 1, quantity: 1 })
    expect(() => utils.validateExportRows(rows)).toThrow(/more than one row for order 1 and item 1/)
  })

  it('rejects numbers stored as strings', () => {
    const rows = validRows() as any
    rows.items[0].price = '10'
    expect(() => utils.validateExportRows(rows)).toThrow(/field price must be a number/)
  })

  it('rejects duplicate ids', () => {
    const rows = validRows()
    rows.orders.push({ id: 1, status: 'pending' })
    expect(() => utils.validateExportRows(rows)).toThrow(/orders has duplicate id 1/)
  })
})

describe('buildLocalImagePath', () => {
  it('replaces characters Windows does not allow', () => {
    const { filename } = utils.buildLocalImagePath('https://x.supabase.co/a/what%3Fis%3Athis%2A.jpg', new Set())
    expect(filename).toBe('what_is_this_.jpg')
  })

  it('dedupes names that only differ by case', () => {
    const used = new Set<string>()
    expect(utils.buildLocalImagePath('https://x/a/Cup.jpg', used).filename).toBe('Cup.jpg')
    expect(utils.buildLocalImagePath('https://x/b/cup.jpg', used).filename).toBe('cup-2.jpg')
  })
})

describe('listUploadFiles', () => {
  it('ignores OS junk files', () => {
    const dir = tempDir()
    for (const name of ['cup.jpg', 'Thumbs.db', 'desktop.ini', '.DS_Store']) fs.writeFileSync(path.join(dir, name), '')
    expect(utils.listUploadFiles(dir)).toEqual(['cup.jpg'])
  })
})

describe('stageUploads', () => {
  function setup() {
    const root = tempDir()
    const source = path.join(root, 'package-uploads')
    const target = path.join(root, 'uploads')
    fs.mkdirSync(source)
    fs.mkdirSync(target)
    fs.writeFileSync(path.join(source, 'new.jpg'), 'new')
    fs.writeFileSync(path.join(target, 'old.jpg'), 'old')
    return { root, source, target }
  }

  it('leaves the current uploads alone until commit', () => {
    const { source, target } = setup()
    const staged = utils.stageUploads(source, target)
    expect(staged.count).toBe(1)
    expect(fs.readdirSync(target)).toEqual(['old.jpg'])

    staged.commit()
    expect(fs.readdirSync(target)).toEqual(['new.jpg'])
  })

  it('discard keeps the current uploads and removes the staged copy', () => {
    const { root, source, target } = setup()
    const staged = utils.stageUploads(source, target)
    staged.discard()
    expect(fs.readdirSync(target)).toEqual(['old.jpg'])
    expect(fs.readdirSync(root).filter((name) => name.startsWith('.'))).toEqual([])
  })
})

describe('resetPackageDirs', () => {
  it('removes leftovers from an earlier run', () => {
    const dir = tempDir()
    fs.mkdirSync(path.join(dir, 'uploads'))
    fs.writeFileSync(path.join(dir, 'uploads', 'stale.jpg'), '')
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{}')
    utils.resetPackageDirs(dir)
    expect(fs.readdirSync(path.join(dir, 'uploads'))).toEqual([])
    expect(fs.existsSync(path.join(dir, 'manifest.json'))).toBe(false)
    expect(fs.existsSync(path.join(dir, 'data'))).toBe(true)
  })
})

describe('build-migration-package SQL parsing', () => {
  it('reads every INSERT statement in a file', () => {
    const sql = `
      INSERT INTO "public"."orders" ("id", "status") VALUES (1, 'pending'), (2, 'completed');
      INSERT INTO "public"."orders" ("id", "status") VALUES (3, 'completed');
    `
    expect(parseSqlText(sql).map((row: any) => row.id)).toEqual([1, 2, 3])
  })

  it('converts quoted numbers and booleans by column', () => {
    const sql = `INSERT INTO "public"."items" ("id", "name", "price", "deleted") VALUES ('7', 'Mug', '4.5', 'false');`
    expect(parseSqlText(sql)).toEqual([{ id: 7, name: 'Mug', price: 4.5, deleted: false }])
  })

  it('keeps escaped quotes and NULLs', () => {
    const sql = `INSERT INTO "public"."items" ("id", "name", "image") VALUES (1, 'It''s, ok', NULL);`
    expect(parseSqlText(sql)).toEqual([{ id: 1, name: "It's, ok", image: null }])
  })

  it('rejects non-numeric ids', () => {
    expect(() => coerceValue('id', 'abc')).toThrow(/non-numeric/)
  })
})

// Ported from the former scripts/test-migration-utils.js

describe('buildLocalImagePath basics', () => {
  it('keeps the extension', () => {
    expect(utils.buildLocalImagePath('https://example.supabase.co/storage/v1/object/public/images/sunflower.jpg', new Set())).toEqual({
      filename: 'sunflower.jpg',
      localPath: '/uploads/sunflower.jpg',
    })
  })

  it('dedupes against names already used', () => {
    const used = new Set(['sunflower.jpg'])
    expect(utils.buildLocalImagePath('https://example.supabase.co/x/sunflower.jpg', used).filename).toBe('sunflower-2.jpg')
  })

  it('replaces encoded path separators', () => {
    expect(
      utils.buildLocalImagePath('https://example.supabase.co/x/folder%5Csunflower%2Fcup.jpg', new Set()).filename
    ).toBe('folder_sunflower_cup.jpg')
  })

  it('falls back to image.jpg for a URL ending in /', () => {
    expect(utils.buildLocalImagePath('https://example.supabase.co/x/', new Set(['image.jpg'])).filename).toBe('image-2.jpg')
  })
})

describe('normalizeSupabaseRow', () => {
  it('maps snake_case keys and keeps the rest', () => {
    expect(
      utils.normalizeSupabaseRow({ id: 1, order_id: 2, item_id: 3, created_at: '2026-05-10T10:00:00.000Z', quantity: 4 })
    ).toEqual({ id: 1, orderId: 2, itemId: 3, createdAt: '2026-05-10T10:00:00.000Z', quantity: 4 })
    expect(utils.normalizeSupabaseRow({ id: 1, name: 'Cup', price: 12.5, deleted: false })).toEqual({
      id: 1,
      name: 'Cup',
      price: 12.5,
      deleted: false,
    })
  })
})

describe('validateExportRows required fields', () => {
  it('names the row and field that is missing', () => {
    const rows = validRows() as any
    rows.items[0].name = null
    expect(() => utils.validateExportRows(rows)).toThrow(/items row 1 missing required field name/)
  })
})

describe('assertLocalDatabaseUrl', () => {
  it.each([
    'postgresql://user:pass@localhost:5432/sunflower_crafts_pos',
    'postgresql://user:pass@127.0.0.1:55432/sunflower_crafts_pos',
    'postgresql://user:pass@[::1]:5432/sunflower_crafts_pos',
  ])('accepts %s', (url) => {
    expect(utils.assertLocalDatabaseUrl(url)).toBe(url)
  })

  it.each([
    ['postgresql://user:pass@example.com:5432/sunflower_crafts_pos', /local database host/],
    ['postgresql://user:pass@localhost:5432/postgres', /database name must be sunflower_crafts_pos/],
    ['postgresql://postgres:pw@localhost:5432/other/sunflower_crafts_pos', /database name must be sunflower_crafts_pos/],
    ['postgresql://user:pass@localhost:5432/sunflower_crafts_pos?host=example.com', /unsafe PostgreSQL query parameter: host/],
    ['not a url', /valid PostgreSQL connection URL/],
  ])('rejects %s', (url, error) => {
    expect(() => utils.assertLocalDatabaseUrl(url)).toThrow(error)
  })

  it('rejects a missing URL', () => {
    expect(() => utils.assertLocalDatabaseUrl(undefined)).toThrow(/DATABASE_URL is not set/)
  })
})

describe('buildSafeSourceDescriptor', () => {
  it('drops credentials, query and hash', () => {
    expect(
      utils.buildSafeSourceDescriptor('https://user:secret@example.supabase.co/storage/v1/object/sign/items/cup.jpg?token=secret#fragment')
    ).toEqual({ origin: 'https://example.supabase.co', pathname: '/storage/v1/object/sign/items/cup.jpg' })
  })
})

describe('listUploadFiles strictness', () => {
  it('rejects folders', () => {
    const dir = tempDir()
    fs.mkdirSync(path.join(dir, 'nested'))
    expect(() => utils.listUploadFiles(dir)).toThrow(/must be a regular file/)
  })

  // Creating symlinks on Windows needs admin rights or developer mode
  it.skipIf(process.platform === 'win32')('rejects symlinks', () => {
    const dir2 = tempDir()
    fs.writeFileSync(path.join(dir2, 'cup.jpg'), '')
    fs.symlinkSync(path.join(dir2, 'cup.jpg'), path.join(dir2, 'cup-link.jpg'))
    expect(() => utils.listUploadFiles(dir2)).toThrow(/must be a regular file/)
  })
})

describe('validateLocalUploadReferences', () => {
  it('accepts existing files and ignores non-upload images', () => {
    const dir = tempDir()
    fs.writeFileSync(path.join(dir, 'cup.jpg'), '')
    expect(() =>
      utils.validateLocalUploadReferences([{ id: 1, image: '/uploads/cup.jpg' }, { id: 2, image: 'https://example.com/a.jpg' }], dir)
    ).not.toThrow()
  })

  it('rejects a missing file unless the package already records it as missing', () => {
    const dir = tempDir()
    const items = [{ id: 1, image: '/uploads/missing.jpg' }]
    expect(() => utils.validateLocalUploadReferences(items, dir)).toThrow(
      /Item 1 references missing restored upload: \/uploads\/missing\.jpg/
    )
    expect(() => utils.validateLocalUploadReferences(items, dir, ['/uploads/missing.jpg'])).not.toThrow()
  })

  it('rejects paths that escape the uploads folder', () => {
    const dir = tempDir()
    fs.writeFileSync(path.join(path.dirname(dir), `outside-${path.basename(dir)}.jpg`), '')
    expect(() =>
      utils.validateLocalUploadReferences([{ id: 1, image: `/uploads/../outside-${path.basename(dir)}.jpg` }], dir)
    ).toThrow(/missing restored upload/)
    fs.rmSync(path.join(path.dirname(dir), `outside-${path.basename(dir)}.jpg`))
  })
})

describe('validateRestoredUploads', () => {
  it('rejects an image count that differs from the manifest', () => {
    const dir = tempDir()
    fs.writeFileSync(path.join(dir, 'cup.jpg'), '')
    expect(() =>
      utils.validateRestoredUploads({
        items: [{ id: 1, image: '/uploads/cup.jpg' }],
        uploadsDir: dir,
        copiedImages: 1,
        manifest: { counts: { images: 2 } },
      })
    ).toThrow(/Restored image count does not match manifest count/)
  })
})

describe('renameWithRetry (Windows file locks)', () => {
  function lockError(code: string) {
    return Object.assign(new Error(`${code}: operation not permitted`), { code })
  }

  it('retries while a scanner holds the folder, then succeeds', () => {
    const dir = tempDir()
    fs.mkdirSync(path.join(dir, 'from'))
    const realRename = fs.renameSync
    let calls = 0
    const spy = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      calls += 1
      if (calls < 3) throw lockError('EPERM')
      return realRename(from, to)
    })
    try {
      utils.renameWithRetry(path.join(dir, 'from'), path.join(dir, 'to'))
    } finally {
      spy.mockRestore()
    }
    expect(calls).toBe(3)
    expect(fs.existsSync(path.join(dir, 'to'))).toBe(true)
  })

  it('gives up after the last attempt', () => {
    const spy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw lockError('EBUSY')
    })
    try {
      expect(() => utils.renameWithRetry('a', 'b', 3)).toThrow(/EBUSY/)
      expect(spy).toHaveBeenCalledTimes(3)
    } finally {
      spy.mockRestore()
    }
  })

  it('does not retry errors that will not go away', () => {
    const spy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw lockError('ENOENT')
    })
    try {
      expect(() => utils.renameWithRetry('a', 'b')).toThrow(/ENOENT/)
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
    }
  })
})
