---
date: 2026-07-03
ticket: SUR-699
area: [auth-bridge, governance]
gate: GCE
verdict: PASS
artefacts_updated:
  - spikes/prf-parity-ios/PrfParity/ContentView.swift
  - spikes/prf-parity-ios/README.md
---

# iOS PRF parity holds — and the two traps that cost the spike a device-swap and a rebuild

## What happened

The SUR-655/SUR-699 spike proved that for the same `braird.app` iCloud-Keychain
passkey and the same eval salt (`SHA-256("surfc-prf-eval-v1")`), Safari/WebKit
and native iPadOS 18 AuthenticationServices return **byte-identical** WebAuthn-PRF
output — and that the native PRF unwraps a real web-wrapped `prf-v1` blob
(exact `keyManager.js` HKDF+AES-GCM parameters), recovering the test MK.
A native iOS Braird app can therefore share the PWA's passkey and master key with
no re-enrolment or migration. Artifacts: `public/prf-test.html` (web baseline) +
`spikes/prf-parity-ios/` (SwiftUI harness), both throwaway (PR #51).

## What surprised me

Two things, one per side of the seam:

1. **The iOS-18 PRF API shape is not what the WebAuthn extension suggests.**
   The assertion input has *no public initializer* — it's built via the static
   factory `ASAuthorizationPublicKeyCredentialPRFAssertionInput.inputValues(_:perCredentialInputValues:)`
   — and the PRF outputs (`prf.first`/`prf.second`) come back as CryptoKit
   `SymmetricKey`, **not** `Data`, so the raw bytes must be extracted via
   `withUnsafeBytes` before hex-printing or feeding a KDF. Harness code written
   from the WebAuthn mental model ("salts in, bytes out") failed to compile on
   five counts. The PR merged before the fix compiled on a real SDK — which is
   how the broken version reached `main` (re-fixed in this PR's cherry-pick).

2. **`?mode=developer` associated domains fail closed with a cached verdict.**
   The native assertion threw `ASAuthorizationError 1004` ("not associated with
   domain") even though the AASA on `braird.app` was verified live, correct, and
   `application/json`. The cause was device-side: developer-mode associations
   are only honoured when **Settings → Developer → Associated Domains
   Development** is ON, and iOS evaluates the association **once, at app
   install**, caching the failure. The fix is toggle-then-**delete-and-reinstall**
   — rebuilding or re-running does nothing, which makes the error look
   server-side and cost most of the debugging round-trip (and a switch to a
   second iPad).

Bonus operational note: the passkey sheet's Face ID does **not** fall back to
passcode the way the lock screen does — pointed at a non-enrolled face it stalls
scanning. On a borrowed device the workable orders are: owner glances, cover the
camera to force the passcode sheet, or temporarily disable Face ID.

## What the gate caught

Nothing — the compiler and the device caught everything the gate would have.
Worth saying explicitly: no persona pass would have caught either trap, because
both live outside the diff (a not-yet-compiled SDK surface; per-device daemon
state). The generalisable lesson for spike-shaped work is that "merged" and
"validated" diverged: PR #51 merged with Swift that had never seen a real SDK.
For future native-harness spikes, compile against the target SDK
(`xcodebuild … CODE_SIGNING_ALLOWED=NO`) *before* the PR, not after — the
capability existed on the build Mac the whole time.

## What to compound

- `spikes/prf-parity-ios/PrfParity/ContentView.swift` — corrected API usage
  (cherry-picked into this PR; `main` held the broken version until now).
- The SUR-699 Linear comment carries the full parity evidence + API notes for
  the real native client; [`braird-core`]'s eventual iOS consumer should start
  from those signatures, not from WebAuthn-spec intuition.
- Run-order rule for any future associated-domains work, worth its own line in
  the next harness README: **enable Associated Domains Development before first
  install; on 1004, toggle → delete app → reinstall** (never just rebuild).

## References

- PR / commit: PR #51 (artifacts), this PR (fix + entry); fix commit cherry-picked from `fdc6ca7`
- Linear ticket: SUR-699 (parent SUR-655; AASA dependency SUR-697)
- Files most affected: `spikes/prf-parity-ios/PrfParity/ContentView.swift`, `public/prf-test.html`
- Related learnings: none yet from this area
