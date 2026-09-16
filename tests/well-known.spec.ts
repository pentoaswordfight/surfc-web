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
 * [SUR-686, SUR-697, SUR-1050, SUR-1085, SUR-1059, SUR-1060]
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

// The native app identities braird.app vouches for. BOTH are load-bearing for the
// length of the Marginborn cutover (SUR-1059, SUR-1060):
//
//   com.braird.app         the identity every already-installed build carries.
//                          Dropping it locks those devices out of their vault.
//   com.braird.marginborn  the permanent identity, immutable after the first store
//                          upload. Published BEFORE the apps change so SUR-1059 is
//                          device-verifiable the day it merges, instead of breaking
//                          passkey sign-in on both platforms until this file catches up.
//
// Both Android statements carry the SAME debug fingerprint on purpose. The release
// cert does not exist until SUR-702 enrols Play App Signing, and SUR-1059 blocks
// SUR-702 — taking the release cert here would make the dependency circular.
//
// PRUNING, at SUR-702. Two INDEPENDENT conditions; do not collapse them into an
// order. Each removal is gated by its own evidence:
//
//   the debug FINGERPRINT   goes only after the release fingerprint is published
//                           alongside it AND the SUR-848 manual PRF gate has passed
//                           on an internal-track build. ADR 0004 makes that gate the
//                           only proof GPM still returns PRF for braird.app, and the
//                           gate runs a debug build — dropping the fingerprint first
//                           leaves the ceremony with no way to be tested at all.
//
//   the com.braird.app      goes only when no device still runs the old build.
//   STATEMENT               An applicationId change makes a NEW app: installs of
//                           com.braird.app never auto-update to com.braird.marginborn.
//                           Remove this statement while one is still out there and
//                           that device is locked out of its E2EE vault, reported
//                           only as "PRF unavailable" (GATING.md §3.1).
const ANDROID_PACKAGES = ['com.braird.app', 'com.braird.marginborn']
const APPLE_APP_IDS = ['7732348SM7.com.braird.app', '7732348SM7.com.braird.marginborn']

// get_login_creds is the relation that makes passkeys resolve. handle_all_urls is App
// Links, inert on both packages today because neither app declares an autoVerify
// intent-filter — so only com.braird.app carries it, as history. SUR-1096 owns
// app-links and adds them deliberately, on the app origin, with the entitlements.
const PASSKEY_RELATION = 'delegate_permission/common.get_login_creds'

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

// The test above proves these files PARSE; nothing proved what they SAY. A bundle ID
// is immutable after the first store upload, so a misspelling here is permanent, and
// its only symptom is "PRF unavailable" on a reader's phone. Same caveat as the ROR
// guard: this catches REMOVAL and MISSPELLING, not omission — the expected lists are
// local copies, so an identity nobody adds is one this file cannot miss. ADDING an
// identity is gated by a real passkey ceremony (GATING.md §3.1), never by a test.
test('the association files vouch for every native app identity', () => {
  const aasa = JSON.parse(read('public/.well-known/apple-app-site-association'))
  const assetlinks = JSON.parse(read('public/.well-known/assetlinks.json'))

  for (const appID of APPLE_APP_IDS) {
    expect(aasa.webcredentials?.apps, `${appID} must stay in AASA webcredentials`).toContain(appID)
  }

  for (const pkg of ANDROID_PACKAGES) {
    const statement = assetlinks.find(entry => entry.target?.package_name === pkg)
    expect(statement, `${pkg} must have an assetlinks statement`).toBeDefined()

    // A statement missing the passkey relation, or carrying an empty fingerprint list,
    // is silently inert: Credential Manager matches package AND fingerprint, and
    // reports neither failure — it simply offers no credential.
    expect(statement.relation, `${pkg} needs ${PASSKEY_RELATION}`).toContain(PASSKEY_RELATION)
    expect(
      statement.target.sha256_cert_fingerprints?.length,
      `${pkg} needs at least one signing fingerprint`,
    ).toBeGreaterThan(0)
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
