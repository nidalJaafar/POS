import { expect, menuCard, orderCard, test } from './fixtures'

test.describe('placing an order', () => {
  test('select items, adjust quantities and place the order', async ({ page, db }) => {
    await db.item('Cup', 12.5)
    await db.item('Mug', 3)
    await page.goto('/')

    await page.getByText('Cup', { exact: true }).click()
    await page.getByText('Mug', { exact: true }).click()
    await page.getByRole('button', { name: 'Increase Cup' }).click()
    await page.getByRole('button', { name: 'Increase Mug' }).click()
    await page.getByRole('button', { name: 'Decrease Mug' }).click()

    const cart = page.locator('div.w-80')
    await expect(cart.getByText('$28.00')).toBeVisible() // 2 × 12.50 + 1 × 3

    await page.getByRole('button', { name: 'Place Order' }).click()
    await expect(page).toHaveURL(/\/orders$/)

    const [order] = await db.query('SELECT id, status FROM orders')
    expect(order.status).toBe('pending')
    await expect(orderCard(page, order.id)).toContainText('2× Cup')
    await expect(orderCard(page, order.id)).toContainText('$28.00')

    const lines = await db.query('SELECT quantity, unit_price FROM items_orders ORDER BY unit_price DESC')
    expect(lines).toEqual([{ quantity: 2, unit_price: 12.5 }, { quantity: 1, unit_price: 3 }])
  })

  test('an item already in the cart cannot be added twice', async ({ page, db }) => {
    await db.item('Cup', 5)
    await page.goto('/')
    await page.getByText('Cup', { exact: true }).first().click()
    await menuCard(page, 'Cup').click()
    await expect(page.getByRole('button', { name: 'Increase Cup' })).toHaveCount(1)
  })

  test('removing the last unit removes the item from the cart', async ({ page, db }) => {
    await db.item('Cup', 5)
    await page.goto('/')
    await page.getByText('Cup', { exact: true }).click()
    await page.getByRole('button', { name: 'Decrease Cup' }).click()
    await expect(page.getByText('No items selected')).toBeVisible()

    await page.getByText('Cup', { exact: true }).click()
    await page.getByRole('button', { name: 'Remove Cup' }).click()
    await expect(page.getByText('No items selected')).toBeVisible()
  })

  test('the order date defaults to today and can be backdated', async ({ page, db }) => {
    await db.item('Cup', 5)
    await page.goto('/')
    const today = await page.evaluate(() => {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    })
    await expect(page.getByLabel('Order date')).toHaveValue(today)

    await page.getByLabel('Order date').fill('2026-02-14')
    await page.getByText('Cup', { exact: true }).click()
    await page.getByRole('button', { name: 'Place Order' }).click()
    await expect(page).toHaveURL(/\/orders$/)

    // Stored as UTC; in the shop's time zone it must be exactly the chosen day
    const [order] = await db.query(
      "SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Beirut', 'YYYY-MM-DD') AS day FROM orders"
    )
    expect(order.day).toBe('2026-02-14')
  })

  test('Place Order is only clicked once even on a double click', async ({ page, db }) => {
    await db.item('Cup', 5)
    await page.goto('/')
    await page.getByText('Cup', { exact: true }).click()
    await page.getByRole('button', { name: 'Place Order' }).dblclick()
    await expect(page).toHaveURL(/\/orders$/)
    expect(await db.query('SELECT id FROM orders')).toHaveLength(1)
  })
})

test.describe('managing orders', () => {
  test('order details show items, date, status and total', async ({ page, db }) => {
    const cup = await db.item('Cup', 10)
    const id = await db.order([{ item: cup, quantity: 3 }], { createdAt: new Date('2026-07-04T09:00:00Z') })

    await page.goto('/orders')
    await orderCard(page, id).click()
    await expect(page).toHaveURL(new RegExp(`/orders/${id}$`))
    await expect(page.getByRole('heading', { name: `#${id}` })).toBeVisible()
    await expect(page.getByText('pending', { exact: true })).toBeVisible()
    await expect(page.getByText('Saturday, July 04, 2026')).toBeVisible()
    await expect(page.getByText('Total: $30.00')).toBeVisible()
  })

  test('edit an order: change quantity, add and remove items', async ({ page, db }) => {
    const cup = await db.item('Cup', 10)
    const mug = await db.item('Mug', 4)
    await db.item('Vase', 20)
    const id = await db.order([{ item: cup, quantity: 1 }, { item: mug, quantity: 2 }])

    await page.goto(`/orders/${id}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page).toHaveURL(new RegExp(`/orders/edit/${id}$`))

    await page.getByRole('button', { name: 'Increase Cup' }).click()
    await page.getByRole('button', { name: 'Decrease Mug' }).click()
    await page.getByRole('button', { name: 'Decrease Mug' }).click() // removes Mug
    await page.getByRole('button', { name: 'Add Item' }).click()
    await page.getByText('Vase', { exact: true }).click()
    await expect(page.getByText('Total: $40.00')).toBeVisible()

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page).toHaveURL(new RegExp(`/orders/${id}$`))
    await expect(page.getByText('Total: $40.00')).toBeVisible()

    const lines = await db.query(
      'SELECT i.name, io.quantity FROM items_orders io JOIN items i ON i.id = io.item_id ORDER BY i.name'
    )
    expect(lines).toEqual([{ name: 'Cup', quantity: 2 }, { name: 'Vase', quantity: 1 }])
  })

  test('an order cannot be saved with no items', async ({ page, db }) => {
    const cup = await db.item('Cup', 10)
    const id = await db.order([{ item: cup, quantity: 1 }])
    await page.goto(`/orders/edit/${id}`)
    await page.getByRole('button', { name: 'Decrease Cup' }).click()
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  })

  test('items already in the order are disabled in the add gallery', async ({ page, db }) => {
    const cup = await db.item('Cup', 10)
    await db.item('Mug', 4)
    const id = await db.order([{ item: cup, quantity: 1 }])
    await page.goto(`/orders/edit/${id}`)
    await page.getByRole('button', { name: 'Add Item' }).click()
    await page.getByText('Cup', { exact: true }).click()
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByRole('button', { name: 'Increase Cup' })).toHaveCount(1)
  })

  test('complete an order from its details page', async ({ page, db }) => {
    const cup = await db.item('Cup', 10)
    const id = await db.order([{ item: cup, quantity: 1 }])
    await page.goto(`/orders/${id}`)
    await page.getByRole('button', { name: 'Complete' }).click()

    await expect(page).toHaveURL(/\/orders\/completed$/)
    await expect(orderCard(page, id)).toBeVisible()
    expect((await db.query('SELECT status FROM orders'))[0].status).toBe('completed')

    // Completed orders have no edit controls
    await orderCard(page, id).click()
    await expect(page.getByText('completed', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)
  })

  test('complete and delete from the order card menu', async ({ page, db }) => {
    const cup = await db.item('Cup', 10)
    const toComplete = await db.order([{ item: cup, quantity: 1 }])
    const toDelete = await db.order([{ item: cup, quantity: 2 }])

    await page.goto('/orders')
    await page.getByRole('button', { name: `Actions for order ${toDelete}` }).click()
    await orderCard(page, toDelete).getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(/\/orders$/)
    await expect(orderCard(page, toDelete)).toHaveCount(0)

    await page.getByRole('button', { name: `Actions for order ${toComplete}` }).click()
    await orderCard(page, toComplete).getByRole('button', { name: 'Complete' }).click()
    await expect(page).toHaveURL(/\/orders\/completed$/)

    expect(await db.query('SELECT id, status FROM orders')).toEqual([{ id: toComplete, status: 'completed' }])
  })

  test('delete an order from its details page', async ({ page, db }) => {
    const cup = await db.item('Cup', 10)
    const id = await db.order([{ item: cup, quantity: 1 }])
    await page.goto(`/orders/${id}`)
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(/\/orders$/)
    await expect(page.getByText('No pending orders.')).toBeVisible()
  })

  test('changing an item price does not change existing orders', async ({ page, db }) => {
    const cup = await db.item('Cup', 10)
    const id = await db.order([{ item: cup, quantity: 2 }], { status: 'completed' })

    await page.goto('/')
    await page.getByRole('button', { name: 'Actions for Cup' }).click()
    await page.getByRole('button', { name: 'Edit Cup' }).click()
    await page.getByLabel('Price').fill('99')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(menuCard(page, 'Cup')).toContainText('$99.00')

    await page.goto(`/orders/${id}`)
    await expect(page.getByText('Total: $20.00')).toBeVisible()
  })

  for (const url of ['/orders/999999', '/orders/abc', '/orders/99999999999', '/orders/edit/999999']) {
    test(`${url} shows the not-found page`, async ({ page }) => {
      await page.goto(url)
      await expect(page.getByText('Page Not Found')).toBeVisible()
    })
  }

  test('the edit link of a completed order opens its details instead', async ({ page, db }) => {
    const cup = await db.item('Cup', 10)
    const id = await db.order([{ item: cup, quantity: 1 }], { status: 'completed' })
    await page.goto(`/orders/edit/${id}`)
    await expect(page).toHaveURL(new RegExp(`/orders/${id}$`))
    await expect(page.getByText('completed', { exact: true })).toBeVisible()
  })
})
