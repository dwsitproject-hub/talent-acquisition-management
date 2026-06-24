import { test, expect } from '@playwright/test'
import { seedLocalStorage } from './seed'

function formatDate(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

test.beforeEach(async ({ page }) => {
  await seedLocalStorage(page)
  // Stub auth to keep user logged in during test
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { user: { id: 'u-1', firstName: 'Test', lastName: 'User', email: 'test@example.com', role: 'TA_HO' } } }),
    })
  })
  await page.goto('/')
})

test('Create Open Position with Remark, then verify View and Summary (SLA + Remark)', async ({ page }) => {
  // Go to Open Position page
  await page.goto('/fptk')
  await expect(page.getByRole('heading', { name: 'Open Position' })).toBeVisible()

  // Open Create modal
  await page.getByRole('button', { name: 'Create New Position' }).click()
  await expect(page.getByRole('heading', { name: /Create New Open Position|Edit Open Position/ })).toBeVisible()

  // Fill required fields
  await page.locator('input[name="pt"]').fill('PT KPN')
  await page.locator('select[name="division"]').selectOption('Engineering')
  await page.locator('input[name="section"]').fill('Platform')
  await page.locator('input[name="hiringManager"]').fill('John Manager')
  await page.locator('input[name="position"]').fill('QA Engineer')
  await page.locator('select[name="employmentType"]').selectOption('Contract')
  await page.locator('select[name="criteria"]').selectOption('Staff')
  await page.locator('select[name="area"]').selectOption('HO')
  await page.locator('select[name="areaDetail"]').selectOption('Jakarta A')
  await page.locator('select[name="additionalOrReplacement"]').selectOption('Additional')
  await page.locator('input[name="totalRequest"]').fill('1')

  // Set request date 10 days ago to land in 0-30 bucket
  await page.locator('input[name="requestDate"]').fill(formatDate(10))

  // Add remark and job spec
  await page.locator('textarea[name="jobSpecification"]').fill('Test spec')
  await page.locator('textarea[name="remark"]').fill('This is a test remark 123')

  // Submit
  await page.locator('form button[type="submit"]').click()

  // Ensure the new position appears in list
  await expect(page.getByRole('listitem').filter({ hasText: 'QA Engineer' })).toBeVisible()

  // Open View modal and verify Remark
  const row = page.getByRole('listitem').filter({ hasText: 'QA Engineer' })
  await row.getByRole('button', { name: 'View' }).click()
  await expect(page.getByText('Open Position Details')).toBeVisible()
  await expect(page.getByText('This is a test remark 123')).toBeVisible()

  // Close view modal
  await page.getByRole('button', { name: 'Close' }).click()

  // Test ends after create + view transaction
})


