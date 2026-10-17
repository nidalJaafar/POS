import os from 'os'
import path from 'path'
import { defineConfig, devices } from '@playwright/test'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { E2E_DATABASE_URL } = require('./scripts/test-db.js')

// The test runner builds seed dates in local time: use the shop's time zone, like the
// browser (timezoneId) and the server (TZ) below
process.env.TZ = 'Asia/Beirut'

const PORT = 3100
// E2E_CHANNEL=chrome uses the installed Google Chrome instead of Playwright's Chromium
const channel = process.env.E2E_CHANNEL || undefined
export const E2E_UPLOADS_DIR = path.join(os.tmpdir(), 'sunflower-e2e-uploads')

export default defineConfig({
  testDir: 'tests/e2e',
  // All tests share one database, so they run one at a time
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The PWA service worker would cache pages between tests
    serviceWorkers: 'block',
    timezoneId: 'Asia/Beirut',
    // No smooth scrolling: Edit scrolls to the top, and a click mid-scroll can land on the
    // wrong element (this made the edit-item tests flaky)
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 }, channel },
      testIgnore: /mobile\.spec\.ts/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    // A production build, like the shop laptop runs (set E2E_SKIP_BUILD=1 to reuse the last build)
    command: process.env.E2E_SKIP_BUILD
      ? `npx next start -H 127.0.0.1 -p ${PORT}`
      : `npx next build && npx next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 10 * 60_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      UPLOADS_DIR: E2E_UPLOADS_DIR,
      TZ: 'Asia/Beirut',
      PRINTER_VID: '',
      PRINTER_PID: '',
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_DIST_DIR: '.next-e2e',
    },
  },
})
