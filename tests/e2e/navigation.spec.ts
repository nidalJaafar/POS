import { expect, imageLoaded, test } from './fixtures'

test.describe('navigation and branding', () => {
  test('sidebar shows the logo and links to every section', async ({ page }) => {
    await page.goto('/')
    await imageLoaded(page, 'Sunflower Crafts')

    await page.getByRole('link', { name: 'Orders' }).click()
    await expect(page).toHaveURL(/\/orders$/)
    await page.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.getByRole('link', { name: 'New Order' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('has the app icons and manifest', async ({ page, request }) => {
    await page.goto('/')
    const icon = await page.locator('link[rel="icon"]').first().getAttribute('href')
    expect((await request.get(icon!)).status()).toBe(200)
    const manifest = await (await request.get('/manifest.json')).json()
    for (const { src } of manifest.icons) expect((await request.get(src)).status()).toBe(200)
  })

  test('unknown pages show the not-found page', async ({ page }) => {
    await page.goto('/does-not-exist')
    await expect(page.getByText('Page Not Found')).toBeVisible()
  })

  test('uploads that do not exist return 404', async ({ request }) => {
    expect((await request.get('/uploads/nope.jpg')).status()).toBe(404)
  })
})
