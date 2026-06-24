import { test, expect } from '@playwright/test'
import { seedLocalStorage } from './seed'

test.beforeEach(async ({ page }) => {
  // Seed localStorage before any navigation
  await seedLocalStorage(page)
  // Stub auth endpoints so pages consider the user authenticated
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { user: { id: 'u-1', firstName: 'Test', lastName: 'User', email: 'test@example.com', role: 'TA_HO' } } }),
    })
  })
  await page.goto('/')
})

test('Dashboard loads and charts visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('Position Status by Location')).toBeVisible()
  await expect(page.getByText('Open Position Progress by Area Detail')).toBeVisible()
  await expect(page.getByText('SLA by Location')).toBeVisible()
})

test('Candidates page shows candidate and position tags', async ({ page }) => {
  await page.goto('/candidates')
  await expect(page.getByRole('heading', { name: 'Candidates' })).toBeVisible()
  await expect(page.getByText('Jane Doe')).toBeVisible()
  await expect(page.getByText('Senior Software Engineer')).toBeVisible()
})

test('Summary by Position lists default statuses', async ({ page }) => {
  await page.goto('/summary-by-position')
  await expect(page.getByRole('heading', { name: 'Summary by Position' })).toBeVisible()
  const table = page.locator('table')
  await expect(table.getByText('Remark')).toBeVisible()
  await expect(table.getByText('SLA')).toBeVisible()
})


