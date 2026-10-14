---
date: 2026-10-14
ticket: SUR-1204
area: [ui, governance, privacy, content]
gate: GCE
verdict: PASS WITH CONCERNS
artefacts_updated:
  - src/pages/how-it-works.astro
  - src/styles/guide.css
  - src/assets/how-it-works/
  - src/components/Faq.astro
  - src/components/ClosingCta.astro
  - tests/how-it-works.spec.ts
  - tests/responsive.spec.ts
---

# A privacy table approved against the App Store notes still understated what the server holds

## What happened

The Marginborn guide for new readers (SUR-1202) replaced `/how-it-works/`. Its privacy section had been worded
from braird-ios `docs/app-store-release.md`, checked line by line against the iOS app, and approved by the founder
the same morning. The FAQ's old privacy answer ("encrypted at rest … stay offline unless you choose to sync") was
rewritten to match it, which made the change GCE under §5 item 5, as the 2026-05-30 entry predicts.

## What surprised me

- **Approval against the release notes was not enough.** The notes list "image paths" as plaintext but say nothing
  about the images. Reading surfc's `image-upload` and `anthropic-proxy`, the claims reviewer found the photos
  themselves stored without the reader's key, and Microsoft Azure AI Content Safety screening the text alongside
  Anthropic. The approved rows understated what the server holds and had to be corrected and re-approved.
- **The site's own privacy policy says the opposite.** `src/policies/privacy.md` (around lines 13, 29 and 40) calls
  photos, tags and the idea index end-to-end encrypted. The corrected guide now contradicts it on the same site
  (SUR-1211, GCE, lockstep with surfc).
- **`npm run check` does not check here.** `astro check` needs `@astrojs/check`, which is not a dependency. Once it
  returned exit 0 without checking anything; the next time it sat at an interactive install prompt.

## What the gate caught

- `blog-claim-reviewer`: four things.
  - The photos were unencrypted, and the page didn't say so.
  - "Before they leave your phone" was untrue, because note text leaves readable when ideas are found.
  - Azure was not named.
  - "Conflict-aware sync" overclaimed, because the later change simply wins.

  It also noticed that the closing button led to the web app while the guide shows the iPhone app.
- `regression-reviewer`: the change is GCE, not CE. The closing section's copy had lost its only test along with
  `carousel.spec.ts`.
- `ux-reviewer`: dot letters read aloud by screen readers, and dots and captions below AA contrast. On a phone the map
  showed two and a half of five places with no cue.
- **The second pass caught two more.**
  - One of the fixes was itself a regression: "Back to chapters" scrolled the chapter links under the fixed nav.
  - The founder's new closing button leads to `/testwithus/`, which is the Android closed-testing page. On a page
    about the iPhone app, that needed a line saying Marginborn is in testing.
  - Azure receives only text, never the photo, so one approved sentence said more than happens and was narrowed.

## What to compound

- **Privacy claims on this site:** read the server functions in surfc as well as the app's release notes, and name
  every processor the policy names, before wording them.
- **`npm run check`:** add `@astrojs/check` to devDependencies (GCE: `package.json`), or drop the script from the
  command list in `CLAUDE.md`. Until then, `npm test` (which builds) is the real check.
- **`GATING.md` §3:** it should carry rows for `src/pages/how-it-works.astro`, `src/styles/guide.css` and
  `src/assets/how-it-works/**`, with the page under the claim rows (SUR-1212).

## References

- Commits: `3da04d7`, `64ed29f` and the commit that adds this entry
- Linear: SUR-1204 (blocked by SUR-1200), SUR-1202, SUR-1211 (privacy policy), SUR-1212 (cleanup), SUR-1213 (restore the closing button)
- Claims ledger: marginborn-guide `ledger/claims.md` (p-01 to p-03 re-approved 2026-10-14) and `ledger/faq.md`
- Related learnings: `2026-05-30-synced-storage-claim-flips-rebrand-to-gce.md`
