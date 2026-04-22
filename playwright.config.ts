/**
 * Playwright configuration for the surfc-web marketing site.
 *
 * The tests run against `astro preview` so they exercise the production
 * static build (what Netlify ultimately serves), not dev-mode HMR output.
 * Waitlist endpoint calls are mocked via page.route() — no live Supabase
 * Edge Function is required. See tests/waitlist.spec.ts.
 *
 * [SUR-218]
 */

import { defineConfig, devices } from '@playwright/test'

// Any syntactically valid URL works: specs intercept via page.route()
// with a path glob, so the host never matters. Setting this at build
// time ensures WaitlistForm's fetch() branch runs instead of falling
// through to a native HTML form submit (which would reload the page
// and skip the modal assertions).
const MOCK_WAITLIST_ENDPOINT = 'https://mock.test.invalid/waitlist-signup'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list']]
    : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace:   'on-first-retry',
  },
  projects: [
    { name: 'chromium',      use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7']        } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url:     'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PUBLIC_WAITLIST_ENDPOINT: MOCK_WAITLIST_ENDPOINT,
      PUBLIC_APP_URL:           'https://app.surfc.app',
    },
  },
})
