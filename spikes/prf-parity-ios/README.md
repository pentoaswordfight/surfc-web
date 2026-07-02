# iOS WebAuthn-PRF parity harness — SUR-655 / SUR-699

**Throwaway spike. Not production code. Do not ship.**

Proves that for the **same braird.app passkey** and the **same PRF eval salt**, the PRF
bytes from **Safari/WebKit** equal the PRF bytes from **native iOS AuthenticationServices**.
Our E2EE master-key unwrap depends on that being byte-identical.

## The two artifacts

1. **Web baseline** — `surfc-web/public/prf-test.html` → deploys to `https://braird.app/prf-test.html`.
   Enrols an iCloud-Keychain passkey, reads its WebAuthn PRF, and prints a `prf-v1` unwrap blob.
2. **Native reading** — this Xcode project (`PrfParity.xcodeproj`). Runs an
   `ASAuthorizationController` assertion against the same passkey and prints the native PRF.

## Shared constants (identical on both sides — that's the whole point)

| Constant | Value |
|---|---|
| RP ID | `braird.app` |
| PRF eval salt (`prf.eval.first` / `saltInput1`) | `SHA-256(UTF8("surfc-prf-eval-v1"))` — 32 bytes |
| Blob KDF | `HKDF-SHA256(ikm=PRF, salt=random32, info="surfc-master-key-wrap-v1")` |
| Blob wrap | `AES-GCM-256`, iv=random12, fields base64 (standard) |

These match `surfc/src/crypto/passkeyEnrollment.js` (`getPrfSalt()`) and
`surfc/src/crypto/keyManager.js` (`wrapMasterKey()`), so the web blob is a *real* one and
the native PRF must unwrap it.

## Prerequisites

- **Real device only** — an iPad Pro on **iPadOS 18.x** (past the early-18 PRF bug), signed
  into iCloud. The Simulator has no iCloud Keychain / platform authenticator — it will not work.
- A Mac with **Xcode 16+** to build and sign.
- **SUR-697 deployed**: `https://braird.app/.well-known/apple-app-site-association` must be live
  and served as `application/json`, listing `webcredentials` for `7732348SM7.com.braird.app`.
  The entitlement uses `?mode=developer` so iOS fetches the AASA directly (not the CDN cache).
- Apple Team ID `7732348SM7` (SUR-134) with automatic signing for bundle id `com.braird.app`.

## Run order

1. **Deploy** `prf-test.html`. In **Safari on the iPad**, open `https://braird.app/prf-test.html`.
2. Tap **Enrol + read PRF** → approve the passkey prompts. Copy:
   - the **web PRF hex**, and
   - the printed **`prf-v1` blob** JSON + the **test MK hex** (tap *Make blob*).
3. Open this project in Xcode on the Mac. Confirm signing:
   *Signing & Capabilities* → Team = your team (`7732348SM7`), bundle id `com.braird.app`,
   Associated Domains shows `webcredentials:braird.app?mode=developer`. Automatic signing on.
4. Run the app on the **same physical iPad** (same iCloud account). Tap
   **Read PRF (assertion)** → approve the passkey prompt. Copy the **native PRF hex**
   (also printed to the Xcode console, prefixed `[prf-parity]`).

## Pass / fail

- **Criterion 2 — parity:** the web PRF hex and the native PRF hex are **byte-identical**.
- **Criterion 3 — unwrap:** feed the **native PRF** + the web `prf-v1` blob into the JS
  `keyManager` HKDF+AES-GCM off-device and confirm it recovers the **same test MK hex**.
  (`unwrapMasterKey(blob, nativePrfBytes)` derives `HKDF-SHA256(salt=blob.salt,
  info="surfc-master-key-wrap-v1")`, AES-GCM-decrypts `blob.wrappedKey` with `blob.iv`.)

If both hold, native AuthenticationServices is byte-compatible with the web PRF and the
iOS arm of SUR-655 is green.

## Notes / gotchas

- The salt is passed **verbatim** as the WebAuthn PRF first input on both sides. Do **not**
  pre-hash it differently — WebKit and AuthenticationServices both apply the WebAuthn PRF
  HMAC construction internally; identical salt in ⇒ identical PRF out *iff* the platforms agree
  (the hypothesis under test).
- If the native assertion returns success but **no PRF**, the passkey was likely enrolled
  without PRF enabled, or the device is on an early-18.0 build with the PRF bug — re-enrol via
  `prf-test.html` and confirm iPadOS ≥ 18.1.
- If Xcode can't open `PrfParity.xcodeproj`, regenerate it with XcodeGen:
  `brew install xcodegen && xcodegen generate` (see `project.yml`).
