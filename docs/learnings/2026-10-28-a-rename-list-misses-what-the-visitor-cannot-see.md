---
date: 2026-10-28
ticket: SUR-1272
area: [pricing, naming]
gate: GCE
verdict: PASS WITH CONCERNS
artefacts_updated:
  - src/pages/pricing.astro
  - src/components/PricingHero.astro
  - src/components/PricingTiers.astro
  - src/components/PricingFaq.astro
  - src/lib/stripeTransition.ts
  - tests/tier-names.spec.ts
---

# A rename list misses what the visitor cannot see

## What happened

SUR-1272 B3 listed seven "Surfc" strings on /pricing, plus "250 MB" storage and a cancel answer that named
"Settings → Billing inside the Surfc app". All were fixed. The cancel answer now names the only real path, in the web
app.

## What surprised me

The ticket's list came from reading the page, and it was complete for what a visitor sees. Scanning the **built**
`dist/pricing/index.html` found one more: both "Get help" links in the checkout overlay and failure banner went to
`mailto:hello@surfc.app`. They are hidden until checkout stalls or fails, and the constant lives in
`src/lib/stripeTransition.ts`, not in a pricing component, so neither the ticket nor a source grep of `Pricing*.astro`
saw it.

The rebrand guard copied from the "Annotator" test (`getByText(...).toHaveCount(0)`) would not have caught it either:
`getByText` reads text nodes, not the `<head>` or any attribute.

## What the gate caught

- `pricing-claim-reviewer`: the chosen cancel path skipped its first step (Settings opens from the Profile tab), and
  the answer becomes false when the web app closes — no test pins it (SUR-1274 item 10).
- The test review: a negative-only mailto assertion passes if the link is deleted; asserting the page source covers
  the head and every attribute in one line.

## What to compound

`tests/tier-names.spec.ts` now asserts `page.content()` has no case-sensitive "Surfc" and pins both help links to
`hello@marginborn.com`. For the next retired name, extend that test, and scan the built page rather than the source.

## References

- PR / commit: _pending_
- Linear ticket: SUR-1272 (follow-ups: SUR-1274 items 9–11)
- Files most affected: `src/components/PricingFaq.astro`, `src/lib/stripeTransition.ts`, `tests/tier-names.spec.ts`
