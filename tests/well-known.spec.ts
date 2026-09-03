/**
 * Continuity guards for the `/.well-known/` files this origin serves.
 *
 * Why they matter: one Cloudflare Pages build serves braird.app, surfc.app and
 * marginborn.com from this one `public/` dir, so `.well-known/webauthn` is the
 * Related Origin Requests allow-list for **both** relying parties at once —
 * braird.app (current) and surfc.app (legacy, still asserted by the SUR-687
 * bridge). GATING.md §3.1 carries the full reasoning and the failure mode.
 *
 * These guards catch **removal**, not omission: `APP_ORIGINS` below is a local
 * copy, so a future app origin that nobody adds to the ROR file also gets no
 * entry here and the suite stays green. The control for that case is the
 * GATING.md §3.1 ceremony gate, not this file.
 *
 * WHY THIS ASSERTS FILES AND NOT HTTP: `astro preview` honours
 * `trailingSlash: 'always'`, so it 404s every extensionless path — the real
 * URL a browser fetches, `/.well-known/webauthn`, cannot be requested under
 * preview at all. Asserting `/.well-known/webauthn/` would prove a shape
 * production never serves. Status and `Content-Type` at the real URL are only
 * provable on the deployed origin, and stay a post-deploy check.
 *
 * Content is read from `public/` rather than `dist/` so a stale build cannot
 * green a broken source: `reuseExistingServer` skips the rebuild whenever a
 * dev or preview server is already up on 4321.
 *
 * [SUR-686, SUR-697, SUR-1050, SUR-1085]
 */

import { readFileSync } from 'node:fs'

import { expect, test } from './fixtures'

// BOTH entries are load-bearing, for different relying parties. Neither is
// redundant, and removing either one silently locks users out:
//
//   app.braird.app      — the SUR-687 migration bridge asserts the OLD
//                         surfc.app-bound passkey from this origin
//                         (`migrateToBrairdRp` calls getEncryptionPrfOutput
//                         with rpId: LEGACY_RP_ID). surfc.app is a different
//                         registrable domain, so that assertion reads this
//                         file as served on surfc.app. Required until
//                         surfc.app sunsets (SUR-683).
//   app.marginborn.com  — `defaultRpId()` returns 'braird.app' there, and
//                         marginborn.com is a different registrable domain, so
//                         every ceremony on that origin reads this file as
//                         served on braird.app (SUR-1085).
const APP_ORIGINS = ['https://app.braird.app', 'https://app.marginborn.com']

const WELL_KNOWN = [
  '.well-known/webauthn',
  '.well-known/apple-app-site-association',
  '.well-known/assetlinks.json',
]

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('well-known files are valid JSON and the ROR list covers every app origin', () => {
  const parsed = WELL_KNOWN.map(path => {
    const body = read(`public/${path}`)
    expect(() => JSON.parse(body), `${path} must be valid JSON`).not.toThrow()
    return JSON.parse(body)
  })

  const ror = parsed[0]
  expect(Array.isArray(ror.origins)).toBe(true)
  for (const origin of APP_ORIGINS) {
    expect(ror.origins, `${origin} must stay in the ROR allow-list`).toContain(origin)
  }
})

// Both ROR and AASA are extensionless, so without these rules Cloudflare Pages
// infers text/plain and Chrome (ROR) and iOS (AASA) both reject the file. The
// rule lives in a different file under a different GATING row, so nothing else
// fails when it is deleted.
test('_headers ships the Content-Type overrides for the extensionless files', () => {
  // Split on either line ending: this repo has no .gitattributes, so the
  // working tree is CRLF on Windows and LF in CI.
  const lines = read('public/_headers').split(/\r?\n/).map(line => line.trim())

  for (const path of ['/.well-known/webauthn', '/.well-known/apple-app-site-association']) {
    const rule = lines.indexOf(path)
    expect(rule, `${path} needs a rule in _headers`).toBeGreaterThan(-1)
    expect(lines[rule + 1] ?? '', `${path} must be served as application/json`)
      .toMatch(/^Content-Type:\s*application\/json$/i)
  }
})

// Astro copying a dot-directory out of public/ is not obvious, and silently
// losing it would drop all three files from the deploy with the source intact.
test('the build copies .well-known/ and _headers into dist/', () => {
  for (const path of [...WELL_KNOWN, '_headers']) {
    expect(() => read(`dist/${path}`), `dist/${path} must exist after a build`).not.toThrow()
  }
})
