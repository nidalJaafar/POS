import { expect, test } from './fixtures'

test.describe('mobile layout', () => {
  test('the menu opens as a drawer and navigates', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByRole('button', { name: 'Toggle menu' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('link', { name: 'Orders' }).click()
    await expect(page).toHaveURL(/\/orders$/)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('the menu button stays usable above the open drawer', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByRole('button', { name: 'Toggle menu' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // Clicking the same button closes it again (it used to be hidden under the drawer)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('the cart opens from the floating button and places an order', async ({ page, db }) => {
    await db.item('Cup', 5)
    await page.goto('/')
    await page.getByText('Cup', { exact: true }).click()

    // Adding an item opens the cart sheet
    await expect(page.getByRole('button', { name: 'Place Order' })).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: 'View Order (1)' }).click()
    await page.getByRole('button', { name: 'Place Order' }).click()

    await expect(page).toHaveURL(/\/orders$/)
    expect(await db.query('SELECT id FROM orders')).toHaveLength(1)
  })
})
