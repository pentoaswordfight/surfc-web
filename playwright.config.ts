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
  webServer: [{
    command: 'npm run build && npm run preview',
    url:     'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PUBLIC_APP_URL: 'https://app.braird.app',
      // SUR-620: PostHog loads only after a consent "allow", and the shared
      // fixture stores a "decline", so the window.posthog stubs that specs
      // install via page.addInitScript survive as before. The token is set
      // (not '') so consent.spec.ts can prove that "allow" really loads
      // PostHog; the host is an inert .test domain the fixture also aborts,
      // so no test can reach a real PostHog project.
      PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test_token',
      PUBLIC_POSTHOG_HOST: 'https://posthog.test',
      // Checkout (SUR-466/496) reads PUBLIC_SUPABASE_URL at build time and
      // throws "not configured" if it's empty. CI has no .env file, so pin a
      // dummy here — the create-checkout-session fetch is always intercepted
      // by page.route() in pricing-checkout.spec.ts, so the value is inert.
      PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  }, {
    // SUR-1062 — the braird.app umbrella build. A second server rather than a
    // second project: the umbrella is a different site from a different config
    // and outDir, not a different viewport on the same one. tests/umbrella.spec.ts
    // pins its baseURL to this port.
    command: 'npm run build:umbrella && npm run preview:umbrella',
    url:     'http://localhost:4322',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  }],
})
