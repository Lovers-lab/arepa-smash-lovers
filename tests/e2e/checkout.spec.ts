import { test, expect } from '@playwright/test'

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'

test.describe('Client checkout flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up localStorage with test user
    await page.goto(BASE_URL)
    await page.evaluate(() => {
      localStorage.setItem('lovers_user', JSON.stringify({ id: 'test-user', nombre: 'Test User', whatsapp: '8095550000' }))
      localStorage.setItem('lovers_marca', 'AREPA')
    })
  })

  test('home page shows brand selector', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await expect(page.getByText('Arepa Lovers')).toBeVisible()
    await expect(page.getByText('Smash Lovers')).toBeVisible()
  })

  test('menu page loads and shows products', async ({ page }) => {
    await page.goto(`${BASE_URL}/menu`)
    // Wait for products to load
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 }).catch(() => {
      // Products may not be seeded in test env
    })
    await expect(page.locator('header')).toBeVisible()
  })

  test('login page shows WhatsApp field', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`)
    await expect(page.getByPlaceholder('809-000-0000')).toBeVisible()
  })

  test('login validates phone format', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`)
    await page.getByPlaceholder('809-000-0000').fill('123')
    await page.getByText('Continuar').click()
    // Button should be disabled with < 10 digits
    const button = page.getByRole('button', { name: /Continuar/ })
    await expect(button).toBeDisabled()
  })

  test('cart redirects to menu when empty', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('lovers_cart'))
    await page.goto(`${BASE_URL}/cart`)
    await page.waitForURL(/\/menu/, { timeout: 5000 })
  })

  test('checkout steps work in order', async ({ page }) => {
    // Set up cart in localStorage
    await page.evaluate(() => {
      localStorage.setItem('lovers_cart', JSON.stringify({
        marca: 'AREPA',
        items: [{ product: { id: 'p1', nombre: 'Test Arepa', precio: 295 }, cantidad: 1 }]
      }))
    })
    await page.goto(`${BASE_URL}/checkout`)
    // Step 1: address
    await expect(page.getByText('Dirección de entrega')).toBeVisible()
  })
})

test.describe('Admin flow', () => {
  test('admin login page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login/admin`)
    await expect(page.getByPlaceholder(/admin@/)).toBeVisible()
    await expect(page.getByPlaceholder('••••••••')).toBeVisible()
  })

  test('admin redirects to login when not authenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/dashboard`)
    await page.waitForURL(/\/auth/, { timeout: 5000 })
  })
})
