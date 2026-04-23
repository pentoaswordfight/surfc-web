/**
 * Playwright configuration for the surfc-web marketing site.
 *
 * The tests run against `astro preview` so they exercise the production
 * static build (what Netlify ultimately serves), not dev-mode HMR output.
 *
 * Most waitlist specs mock the endpoint via page.route() — useful for
 * UI-state assertions but blind to the network stack. To guard against the
 * SUR-218 class of bug (Edge Function's Access-Control-Allow-Headers
 * regressing to omit `apikey`), we also run a tiny local fixture server
 * (tests/fixtures/cors-server.mjs) that mirrors the real Edge Function's
 * CORS contract and point PUBLIC_WAITLIST_ENDPOINT at it. The fixture-backed
 * spec submits the form for real and asserts both that the request went
 * through end-to-end AND that the browser forwarded the `apikey` header that
 * makes the preflight necessary in the first place.
 *
 * [SUR-218]
 */

import { defineConfig, devices } from '@playwright/test'

const CORS_FIXTURE_PORT     = 5179
const WAITLIST_ENDPOINT_URL = `http://127.0.0.1:${CORS_FIXTURE_PORT}/waitlist-signup`

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
  webServer: [
    {
      command: `node tests/fixtures/cors-server.mjs`,
      url:     `http://127.0.0.1:${CORS_FIXTURE_PORT}/__cors-fixture/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
      env: {
        CORS_FIXTURE_PORT: String(CORS_FIXTURE_PORT),
      },
    },
    {
      command: 'npm run build && npm run preview',
      url:     'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        PUBLIC_WAITLIST_ENDPOINT:   WAITLIST_ENDPOINT_URL,
        PUBLIC_APP_URL:             'https://app.surfc.app',
        // The form only attaches the `apikey` header (which triggers the
        // cross-origin preflight on the Edge Function) when this env var is
        // set at build time. The CORS fixture doesn't verify the value, so
        // any placeholder works.
        PUBLIC_SUPABASE_ANON_KEY:   'test-anon-key-for-preflight',
      },
    },
  ],
})

export const CORS_FIXTURE_INSPECT_URL =
  `http://127.0.0.1:${CORS_FIXTURE_PORT}/__cors-fixture/inspect`
