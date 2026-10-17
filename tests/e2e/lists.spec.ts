import { expect, orderCard, test } from './fixtures'

test.describe('pending orders list', () => {
  test('paginates 24 per page with next, previous and jump-to-page', async ({ page, db }) => {
    const cup = await db.item('Cup', 1)
    const ids: number[] = []
    for (let i = 0; i < 50; i++) ids.push(await db.order([{ item: cup, quantity: 1 }], { createdAt: new Date(2026, 0, 1, 12) }))
    const newestFirst = [...ids].sort((a, b) => b - a)

    await page.goto('/orders')
    await expect(page.getByText('of 3')).toBeVisible()
    await expect(orderCard(page, newestFirst[0])).toBeVisible()
    await expect(orderCard(page, newestFirst[24])).toHaveCount(0)

    await page.getByRole('link', { name: 'Next' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByLabel('Page number')).toHaveValue('2')
    await expect(orderCard(page, newestFirst[24])).toBeVisible()

    await page.getByLabel('Page number').fill('3')
    await page.getByLabel('Page number').press('Enter')
    await expect(page).toHaveURL(/page=3/)
    await expect(orderCard(page, newestFirst[49])).toBeVisible()

    // Focusing and leaving the box without changes must not jump anywhere
    await page.getByLabel('Page number').focus()
    await page.getByLabel('Page number').blur()
    await expect(page).toHaveURL(/page=3/)

    // Clearing the box restores the current page instead of jumping to page 1
    await page.getByLabel('Page number').fill('')
    await page.getByLabel('Page number').blur()
    await expect(page.getByLabel('Page number')).toHaveValue('3')
    await expect(page).toHaveURL(/page=3/)

    await page.getByRole('link', { name: 'Previous' }).click()
    await expect(page).toHaveURL(/page=2/)
  })

  test('sorts newest or oldest first', async ({ page, db }) => {
    const cup = await db.item('Cup', 1)
    const older = await db.order([{ item: cup, quantity: 1 }], { createdAt: new Date(2026, 0, 1) })
    const newer = await db.order([{ item: cup, quantity: 1 }], { createdAt: new Date(2026, 5, 1) })

    await page.goto('/orders')
    const cards = page.locator('div.rounded-2xl.cursor-pointer span.text-lg')
    await expect(cards).toHaveText([String(newer), String(older)])

    await page.getByRole('link', { name: 'Newest first' }).click()
    await expect(page.getByRole('link', { name: 'Oldest first' })).toBeVisible()
    await expect(cards).toHaveText([String(older), String(newer)])
  })

  test('filters by period', async ({ page, db }) => {
    const cup = await db.item('Cup', 1)
    const today = await db.order([{ item: cup, quantity: 1 }])
    const lastYear = await db.order([{ item: cup, quantity: 1 }], {
      createdAt: new Date(new Date().getFullYear() - 1, 5, 1),
    })

    await page.goto('/orders')
    await page.getByRole('link', { name: 'Today' }).click()
    await expect(page).toHaveURL(/period=today/)
    await expect(orderCard(page, today)).toBeVisible()
    await expect(orderCard(page, lastYear)).toHaveCount(0)

    await page.getByRole('link', { name: 'All time' }).click()
    await expect(orderCard(page, lastYear)).toBeVisible()
  })

  test('shows an empty state', async ({ page }) => {
    await page.goto('/orders')
    await expect(page.getByText('No pending orders.')).toBeVisible()
  })
})

test.describe('completed orders list', () => {
  test('groups orders under their local day', async ({ page, db }) => {
    const cup = await db.item('Cup', 1)
    // 00:30 in Beirut is still the previous day in UTC
    await db.order([{ item: cup, quantity: 1 }], { status: 'completed', createdAt: new Date('2026-07-01T21:30:00Z') })
    await db.order([{ item: cup, quantity: 1 }], { status: 'completed', createdAt: new Date('2026-07-01T10:00:00Z') })

    await page.goto('/orders/completed')
    await expect(page.getByRole('heading', { name: 'Thursday, July 02, 2026' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Wednesday, July 01, 2026' })).toBeVisible()
  })

  test('search finds an order on any page', async ({ page, db }) => {
    const cup = await db.item('Cup', 1)
    const ids: number[] = []
    for (let i = 0; i < 70; i++) ids.push(await db.order([{ item: cup, quantity: 1 }], { status: 'completed' }))
    const oldest = ids[0] // on page 2 by default

    await page.goto('/orders/completed')
    await expect(orderCard(page, oldest)).toHaveCount(0)

    await page.getByPlaceholder('Search by order #').fill(String(oldest))
    await expect(page).toHaveURL(new RegExp(`q=${oldest}`))
    await expect(orderCard(page, oldest)).toBeVisible()
    await expect(page.locator('div.rounded-2xl.cursor-pointer')).toHaveCount(1)

    await page.getByPlaceholder('Search by order #').fill('')
    await expect(page).not.toHaveURL(/q=/)
    await expect(page.locator('div.rounded-2xl.cursor-pointer')).toHaveCount(60)
  })

  test('the calendar picker filters to a day or a range', async ({ page, db }) => {
    const cup = await db.item('Cup', 1)
    const july1 = await db.order([{ item: cup, quantity: 1 }], { status: 'completed', createdAt: new Date('2026-07-01T10:00:00Z') })
    const july3 = await db.order([{ item: cup, quantity: 1 }], { status: 'completed', createdAt: new Date('2026-07-03T10:00:00Z') })
    const july9 = await db.order([{ item: cup, quantity: 1 }], { status: 'completed', createdAt: new Date('2026-07-09T10:00:00Z') })

    await page.goto('/orders/completed?period=year')
    await page.getByLabel('From date').fill('2026-07-03')
    await expect(page).toHaveURL(/from=2026-07-03/)
    await expect(page).not.toHaveURL(/period=/)
    await expect(orderCard(page, july3)).toBeVisible()
    await expect(page.locator('div.rounded-2xl.cursor-pointer')).toHaveCount(1)

    await page.getByLabel('To date').fill('2026-07-09')
    await expect(page).toHaveURL(/to=2026-07-09/)
    await expect(orderCard(page, july9)).toBeVisible()
    await expect(orderCard(page, july1)).toHaveCount(0)

    await page.getByRole('link', { name: 'Clear dates' }).click()
    await expect(page).not.toHaveURL(/from=|to=/)
    await expect(page.locator('div.rounded-2xl.cursor-pointer')).toHaveCount(3)
  })

  test('choosing a period clears picked dates', async ({ page, db }) => {
    const cup = await db.item('Cup', 1)
    await db.order([{ item: cup, quantity: 1 }])
    await page.goto('/orders?from=2020-01-01')
    await expect(page.getByText('No pending orders.')).toBeVisible()
    await page.getByRole('link', { name: 'Today' }).click()
    await expect(page).toHaveURL(/period=today/)
    await expect(page).not.toHaveURL(/from=/)
    await expect(page.locator('div.rounded-2xl.cursor-pointer')).toHaveCount(1)
  })

  test('the search box clears when the Completed tab resets the list', async ({ page, db }) => {
    const cup = await db.item('Cup', 1)
    const id = await db.order([{ item: cup, quantity: 1 }], { status: 'completed' })
    await page.goto(`/orders/completed?q=${id}`)
    await expect(page.getByPlaceholder('Search by order #')).toHaveValue(String(id))
    await page.getByRole('link', { name: 'Completed' }).click()
    await expect(page).not.toHaveURL(/q=/)
    await expect(page.getByPlaceholder('Search by order #')).toHaveValue('')
  })

  test('shows an empty state for a search with no match', async ({ page, db }) => {
    const cup = await db.item('Cup', 1)
    await db.order([{ item: cup, quantity: 1 }], { status: 'completed' })
    await page.goto('/orders/completed?q=424242')
    await expect(page.getByText('No completed orders found.')).toBeVisible()
  })

  test('tabs switch between pending and completed', async ({ page }) => {
    await page.goto('/orders')
    await page.getByRole('link', { name: 'Completed' }).click()
    await expect(page).toHaveURL(/\/orders\/completed$/)
    await page.getByRole('link', { name: 'Pending' }).click()
    await expect(page).toHaveURL(/\/orders$/)
  })
})
