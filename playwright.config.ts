/**
 * Playwright configuration for the surfc-web marketing site.
 *
 * The tests run against `astro preview` so they exercise the production
 * static build (what Cloudflare Pages ultimately serves), not dev-mode HMR
 * output.
 *
 * (Pre-SUR-365 we also booted a local CORS fixture server to live-test the
 * waitlist Edge Function's preflight contract; that whole stack went away
 * with the waitlist surface.)
 */

import { defineConfig, devices } from '@playwright/test'

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
      PUBLIC_APP_URL: 'https://app.surfc.app',
      // Suppress the PostHog snippet in test builds. Its init IIFE
      // overwrites any window.posthog stub we install via
      // page.addInitScript before the engagement script runs — without
      // this override the SUR-256 blog_scroll_depth / blog_read_complete
      // assertions can't see captured events.
      PUBLIC_POSTHOG_PROJECT_TOKEN: '',
    },
  },
})
