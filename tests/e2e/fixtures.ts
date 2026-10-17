import fs from 'fs'
import os from 'os'
import path from 'path'
import { Pool } from 'pg'
import sharp from 'sharp'
import { test as base, expect, Page } from '@playwright/test'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { E2E_DATABASE_URL } = require('../../scripts/test-db.js')

export const UPLOADS_DIR = path.join(os.tmpdir(), 'sunflower-e2e-uploads')

export class Db {
  constructor(private pool: Pool) {}

  async reset() {
    await this.pool.query('TRUNCATE items_orders, orders, items RESTART IDENTITY CASCADE')
  }

  // Items get a real image in the uploads folder so pages render like production
  async item(name: string, price: number, options: { deleted?: boolean } = {}) {
    const filename = `${name.toLowerCase().replace(/\W+/g, '-')}.jpg`
    await sharp({ create: { width: 40, height: 40, channels: 3, background: '#F7C15B' } })
      .jpeg()
      .toFile(path.join(UPLOADS_DIR, filename))
    const { rows } = await this.pool.query(
      'INSERT INTO items (name, price, image, deleted) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, price, `/uploads/${filename}`, options.deleted ?? false]
    )
    return { id: rows[0].id as number, name, price }
  }

  async order(
    lines: { item: { id: number; price: number }; quantity: number; unitPrice?: number }[],
    options: { status?: 'pending' | 'completed'; createdAt?: Date } = {}
  ) {
    const { rows } = await this.pool.query(
      'INSERT INTO orders (status, created_at) VALUES ($1, $2) RETURNING id',
      // Prisma stores UTC wall-clock time in these timestamp columns; send the same
      [options.status ?? 'pending', (options.createdAt ?? new Date()).toISOString()]
    )
    const orderId = rows[0].id as number
    for (const line of lines) {
      await this.pool.query(
        'INSERT INTO items_orders (order_id, item_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
        [orderId, line.item.id, line.quantity, line.unitPrice ?? line.item.price]
      )
    }
    return orderId
  }

  async query<T = any>(sql: string, params: unknown[] = []) {
    return (await this.pool.query(sql, params)).rows as T[]
  }
}

export const test = base.extend<{ db: Db }>({
  // auto: every test starts from an empty database, even ones that never touch `db`
  db: [
    async ({}, use) => {
      const pool = new Pool({ connectionString: E2E_DATABASE_URL })
      const db = new Db(pool)
      await db.reset()
      await use(db)
      await pool.end()
    },
    { auto: true },
  ],
})

export { expect }

export async function photo(name = 'photo.png') {
  const file = path.join(os.tmpdir(), `sunflower-e2e-${name}`)
  await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#C7933D' } })
    .png()
    .toFile(file)
  return file
}

// The card for a menu item on the New Order page
export function menuCard(page: Page, name: string) {
  return page.locator('div.rounded-2xl').filter({ has: page.getByText(name, { exact: true }) }).last()
}

// The card for an order in the orders lists
export function orderCard(page: Page, orderId: number) {
  return page.locator('div.rounded-2xl.cursor-pointer').filter({
    has: page.locator('span.text-lg', { hasText: new RegExp(`^${orderId}$`) }),
  })
}

export async function imageLoaded(page: Page, alt: string) {
  const image = page.getByRole('img', { name: alt }).first()
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
}
