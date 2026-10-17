import { expect, test } from './fixtures'

test.describe('dashboard', () => {
  test('shows this month’s revenue, top item and order count', async ({ page, db }) => {
    const cup = await db.item('Cup', 10)
    const mug = await db.item('Mug', 4)
    await db.order([{ item: cup, quantity: 2 }, { item: mug, quantity: 5 }], { status: 'completed' })
    await db.order([{ item: cup, quantity: 1, unitPrice: 8 }], { status: 'completed' })
    // Pending and last year's orders don't count toward this month
    await db.order([{ item: cup, quantity: 50 }])
    await db.order([{ item: cup, quantity: 9 }], {
      status: 'completed',
      createdAt: new Date(new Date().getFullYear() - 1, 2, 3),
    })

    await page.goto('/dashboard')
    const card = (label: string) => page.locator('div', { has: page.getByText(label, { exact: true }) }).last()
    await expect(card('Total completed orders')).toContainText('3')
    await expect(card('Revenue this month')).toContainText('$48.00') // 2×10 + 5×4 + 1×8
    await expect(card('Top item this month')).toContainText('Mug')
  })

  test('renders the charts', async ({ page, db }) => {
    const cup = await db.item('Cup', 10)
    await db.order([{ item: cup, quantity: 2 }], { status: 'completed' })
    await page.goto('/dashboard')
    await expect(page.locator('canvas')).not.toHaveCount(0)
  })

  test('reflects a newly completed order', async ({ page, db }) => {
    const cup = await db.item('Cup', 10)
    const id = await db.order([{ item: cup, quantity: 3 }])

    await page.goto('/dashboard')
    const revenue = page.locator('div', { has: page.getByText('Revenue this month', { exact: true }) }).last()
    await expect(revenue).toContainText('$0.00')

    await page.goto(`/orders/${id}`)
    await page.getByRole('button', { name: 'Complete' }).click()
    await expect(page).toHaveURL(/completed/)

    await page.goto('/dashboard')
    await expect(revenue).toContainText('$30.00')
  })

  test('works with no orders at all', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('Total completed orders')).toBeVisible()
    await expect(page.locator('div', { has: page.getByText('Top item this month', { exact: true }) }).last()).toContainText('—')
  })
})
