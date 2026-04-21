import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'staging',
      use: {
        ...devices['Pixel 7'],
        baseURL: process.env.STAGING_URL || 'https://staging-arepa-smash-lovers.vercel.app',
      },
    },
    {
      name: 'local',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'production',
      use: {
        ...devices['Pixel 7'],
        baseURL: 'https://arepa-smash-lovers.com',
      },
    },
  ],
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
