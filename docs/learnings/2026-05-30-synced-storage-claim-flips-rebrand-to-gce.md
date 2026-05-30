---
date: 2026-05-30
ticket: SUR-479
area: [ui, governance, blog]
gate: GCE
verdict: PASS
artefacts_updated:
  - src/components/WhatSurfcIs.astro
  - src/components/Hero.astro
  - src/components/SupportingCards.astro
  - src/components/CapturePassages.astro
  - src/components/TagIdeas.astro
  - src/components/ClosingCta.astro
  - src/components/PulledQuote.astro
  - src/pages/index.astro
---

# One sentence ("…including synced storage") flipped a surface rebrand into a spine/GCE change

## What happened

SUR-479 began life as a copy-only landing-page rebrand — vocabulary swaps
(`Your index` → `Your Commonplace`, `Sources & notes` → `Library & notes`),
a verbosity/JTBD pass, and cutting the `PulledQuote` section. All of that is
textbook **surface / CE** under `GATING.md` §3.2. Then a Part C scope
expansion folded three discovery-brief claims into the `WhatSurfcIs` body —
including the SUR-117-cleared E2EE line *"…end-to-end encryption at rest,
including synced storage."*

## What surprised me

The whole change re-classified on the strength of **eleven words**. A
privacy/security claim in *marketing* copy hits `GATING.md` §5 triage item 5
(→ Spine, GCE), and §4 says once any part of a change escalates, the *entire*
PR rides at GCE for its lifecycle. A rebrand I'd scoped as "founder reads a
persona report, not the diff" became "founder signs off + cross-check the
claim against `surfc/` reality." The trigger wasn't a code path or a new
dependency — it was a single declarative sentence about data handling.

## What the gate caught

Two things the initial brief glossed:

1. **Claim-consistency drift.** The new line asserts synced storage is E2EE,
   but the un-edited `Faq.astro:29` ("…stay offline unless you choose to
   sync") and `SupportingCards.astro` card #3 ("…at rest with AES-256-GCM")
   make *narrower* claims. Founder confirmed synced-storage E2EE is true and
   live, so they're non-contradictory — but the strongest claim on the page
   now lives in a different component from the older, softer ones. A future
   `blog-claim-reviewer` pass should treat "strongest claim diverges from
   sibling claims" as a standing check.
2. **A literal-vs-rendered AC conflict.** The "grep-clean for 'reading
   companion'" AC collided with the "preserve `PulledQuote.astro` unedited"
   instruction: the dormant (unwired) component still contained the retired
   phrase. Rendered output was already clean; the literal grep was not.
   Founder chose to retire the phrase in the dormant file too, future-proofing
   it against the SUR-497 never-use list.

## What to compound

- **`GATING.md` §5 (triage) — add a worked example to item 5:** *"A privacy/
  security/E2EE sentence added to a marketing component (e.g. `WhatSurfcIs`)
  escalates that component to spine even when the surrounding edit is a copy
  rebrand."* Right now item 5 reads as if it's mostly about blog posts; this
  ticket proves it bites on any visitor-facing component. (Proposed — GATING.md
  is itself GCE meta; flagged for founder, not self-applied.)
- **`blog-claim-reviewer` persona:** add a "claim-consistency across the page"
  check — when a component states a stronger version of a claim made
  elsewhere, flag the weaker siblings for alignment rather than just checking
  the new claim against product reality in isolation.

## References

- PR / commit: see SUR-479 PR (branch `dejidipeolu/sur-479-landing-page-rebrand`)
- Linear ticket: SUR-479 (blocked-by SUR-497; ships the SUR-117 cleared E2EE line; blocks SUR-510)
- Files most affected: `src/components/WhatSurfcIs.astro`, `src/pages/index.astro`
- Related learnings: `2026-05-15-grounding-the-gating-skeleton.md`
