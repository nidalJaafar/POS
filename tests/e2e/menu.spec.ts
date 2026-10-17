import { expect, imageLoaded, menuCard, photo, test } from './fixtures'

test.describe('menu items', () => {
  test('adding an item with a photo shows it straight away with its image', async ({ page, db }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Add Item' }).click()
    await page.locator('input#image').setInputFiles(await photo())
    await page.getByLabel('Price').fill('12.5')
    await page.getByLabel('Item name').fill('Sunflower Mug')
    await page.getByRole('button', { name: 'Save' }).click()

    // No reload: the new item must appear from the refreshed server data
    await expect(menuCard(page, 'Sunflower Mug')).toBeVisible()
    await expect(menuCard(page, 'Sunflower Mug')).toContainText('$12.50')
    // Uploaded after the server started, and still served
    await imageLoaded(page, 'Sunflower Mug')

    const [item] = await db.query('SELECT name, price, image FROM items')
    expect(item).toMatchObject({ name: 'Sunflower Mug', price: 12.5 })
    expect(item.image).toMatch(/^\/uploads\/.+\.jpg$/)
  })

  test('editing an item fills the form and saves the changes', async ({ page, db }) => {
    await db.item('Cup', 5)
    await db.item('Vase', 20)
    await page.goto('/')

    await page.getByRole('button', { name: 'Actions for Cup' }).click()
    await page.getByRole('button', { name: 'Edit Cup' }).click()
    await expect(page.getByLabel('Item name')).toHaveValue('Cup')
    await expect(page.getByLabel('Price')).toHaveValue('5')

    // Switching to another item refreshes the form
    await page.getByRole('button', { name: 'Actions for Vase' }).click()
    await page.getByRole('button', { name: 'Edit Vase' }).click()
    await expect(page.getByLabel('Item name')).toHaveValue('Vase')

    await page.getByLabel('Item name').fill('Tall Vase')
    await page.getByLabel('Price').fill('22')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(menuCard(page, 'Tall Vase')).toContainText('$22.00')
    await expect(page.getByText('Vase', { exact: true })).toHaveCount(0)
  })

  test('the add form is empty again after editing', async ({ page, db }) => {
    await db.item('Cup', 5)
    await page.goto('/')
    await page.getByRole('button', { name: 'Actions for Cup' }).click()
    await page.getByRole('button', { name: 'Edit Cup' }).click()
    await page.getByLabel('Item name').fill('Cup 2')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(menuCard(page, 'Cup 2')).toBeVisible()

    await page.getByRole('button', { name: 'Add Item' }).click()
    await expect(page.getByLabel('Item name')).toHaveValue('')
    await expect(page.getByLabel('Price')).toHaveValue('')
  })

  test('deleting an item moves it to Deleted Items, and it can be restored', async ({ page, db }) => {
    await db.item('Cup', 5)
    await page.goto('/')

    await page.getByRole('button', { name: 'Actions for Cup' }).click()
    await page.getByRole('button', { name: 'Delete Cup' }).click()
    await expect(page.getByRole('heading', { name: 'Deleted Items' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Menu Items' })).toHaveCount(0)
    await expect.poll(async () => (await db.query('SELECT deleted FROM items'))[0].deleted).toBe(true)

    // Still deleted after a reload
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Deleted Items' })).toBeVisible()

    await page.getByRole('button', { name: 'Actions for Cup' }).click()
    await page.getByRole('button', { name: 'Restore Cup' }).click()
    await expect(page.getByRole('heading', { name: 'Menu Items' })).toBeVisible()
    await expect.poll(async () => (await db.query('SELECT deleted FROM items'))[0].deleted).toBe(false)
  })

  test('deleted items cannot be added to an order', async ({ page, db }) => {
    await db.item('Cup', 5, { deleted: true })
    await page.goto('/')
    await page.getByText('Cup', { exact: true }).click()
    await expect(page.getByText('No items selected')).toBeVisible()
  })

  test('search filters the menu by name', async ({ page, db }) => {
    await db.item('Sunflower Mug', 5)
    await db.item('Clay Vase', 8)
    await page.goto('/')

    await page.getByPlaceholder('Search').fill('mug')
    await expect(page.getByText('Sunflower Mug', { exact: true })).toBeVisible()
    await expect(page.getByText('Clay Vase', { exact: true })).toHaveCount(0)

    await page.getByPlaceholder('Search').fill('')
    await expect(page.getByText('Clay Vase', { exact: true })).toBeVisible()
  })

  test('rejects a file that is not an image', async ({ page, db }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Add Item' }).click()
    await page.locator('input#image').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
    await page.getByLabel('Price').fill('3')
    await page.getByLabel('Item name').fill('Broken')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('An Error Occurred')).toBeVisible()
    expect(await db.query('SELECT * FROM items')).toEqual([])
  })
})
