---
date: 2026-05-15
ticket: SUR-422
area: [governance, agents, meta]
gate: N/A
verdict: N/A
artefacts_updated:
  - GATING.md
  - prompts/personas/README.md
  - prompts/personas/auth-bridge-reviewer.md
  - prompts/personas/pricing-claim-reviewer.md
  - prompts/personas/legal-copy-reviewer.md
  - prompts/personas/blog-claim-reviewer.md
  - prompts/personas/perf-budget-reviewer.md
  - prompts/personas/seo-reviewer.md
  - prompts/personas/regression-reviewer.md
  - prompts/personas/ux-reviewer.md
  - prompts/personas/naming-reviewer.md
  - docs/learnings/README.md
  - docs/learnings/_template.md
  - CLAUDE.md
  - AGENTS.md
  - CONTRIBUTING.md
---

# Grounding the gating skeleton against the actual surfc-web repo

## What happened

Deployed the Gated / Conducted Engineering framework to `surfc-web` per
SUR-422: a grounded `GATING.md`, six new repo-specific personas, three
adapted reusable personas, the `docs/learnings/` scaffolding, and the
wiring sections in `CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING.md`. The
brief required a per-repo grounding pass — verifying every `[VERIFY]`
marker and every §3 path against the real codebase before the doc could
be called operational.

## What surprised me

The `surfc/` deployment found **8 of 11** §3 path assumptions wrong,
because that skeleton was drafted from memory. This one was different:
the `surfc-web` skeleton was derived from the *already-grounded*
`CLAUDE.md` in this repo, so nearly every spine path verified on the
first Glob (`src/lib/{auth,checkout,appUrl}.ts`, `Pricing*.astro`,
`preserveUtm.ts`, `policies/{privacy,terms}.astro`, `fonts.css`,
`lighthouserc.cjs`, both CI workflows, `playwright.config.ts`,
`tests/fixtures.ts` — all correct as written). **A skeleton derived from
a grounded artefact fails by *omission*, not by *hallucination*.** The
errors weren't wrong paths; they were ~8 missing ones:
`src/lib/posthog.ts` (a dedicated typed PostHog accessor the skeleton
folded into "BaseLayout inline"), `src/content.config.ts` (the Zod blog
schema — a build-breaking spine path with no persona assigned),
`src/pages/rss.xml.js` (an unlisted SEO surface), and
`src/pages/waitlist.astro` (cited in the skeleton's SUR-365 appendix row
but absent from the §3 table it was supposed to gate). The skeleton also
under-specified the surface tier: `index.astro`, the blog pages, the
three `src/styles/*.css` files, and `remark-reading-time.mjs` had no
home.

The second surprise: the brief said `regression-reviewer` and
`naming-reviewer` were reusable "as-is." They are not. The `surfc/`
originals are saturated with React/PWA/crypto/Supabase context
(`src/crypto/**`, offline-first convergence, the Anthropic proxy, Dexie
outbox) that is *actively wrong* for a static Astro site with no server
and no unit tests. "Copy as-is" would have shipped a regression persona
that tells reviewers to check offline-first behaviour on a site that has
no offline mode. The grounding rule ("the repo wins") had to override the
brief here.

## What the gate caught

No formal gate ran — this is the artefact that *builds* the gate. But the
meta-finding holds and is now repo-specific: **the value of a grounding
pass is inversely proportional to how grounded the source already was.**
For `surfc/` the pass was load-bearing (8/11 wrong). For `surfc-web` the
pass was still necessary but caught a different failure mode (omission +
inherited-context mismatch) that a "looks fine, ship it" review would
have missed precisely *because* the paths that were present were all
correct — the gaps were invisible without enumerating `src/**` directly.

## What to compound

1. **`GATING.md` §3 now lists the omitted paths** with assigned
   patterns/personas: `src/lib/posthog.ts` and `src/content.config.ts`
   added to spine; `src/pages/waitlist.astro` and `src/pages/rss.xml.js`
   added to the `seo-reviewer` rows; `index.astro`, blog pages,
   `src/styles/*.css`, `remark-reading-time.mjs` placed in §3.2/§3.1.
2. **`GATING.md` §7 quarterly review** now explicitly includes
   "re-ground §3 against the repo (Glob/Read)" — the omission failure
   mode means a stale §3 silently *under-gates* new paths, which is worse
   than over-gating.
3. **The three reusable personas were adapted, not copied**, each with a
   provenance note at the top stating what was changed and why. The
   `prompts/personas/README.md` records the policy: shared parts (report
   shape, public vocabulary, the `'free' | 'pro'` → Reader/Annotator/
   Syntopist tier-name landmine) are verbatim; repo-specific context is
   retargeted. Future repo deployments should treat "reusable as-is" in a
   brief as a hypothesis to test, not an instruction.
4. **Operational rule reaffirmed for this repo:** memory (and a brief)
   are not a source of truth for paths or for cross-repo reuse claims —
   Glob/Read before writing. This is the same rule the `surfc/` seed
   entry established; this entry is the second data point, which makes it
   a *pattern*, not an anecdote — flag at the next `GATING.md` review.
5. **Self-contained `GATING.md`:** the skeleton used `[Same as surfc/
   GATING.md §X]` references for §2/§4/§6/§7/§8. Since `surfc/` is not
   checked out alongside this repo, those were inlined — a dangling
   cross-repo reference in a governance doc is itself a gating failure.

## References

- PR / commit: branch `chore/sur-422-introduce-gating-policy`, commit
  `chore(governance): introduce GATING.md, persona library, and
  learnings directory [SUR-422]`.
- Linear ticket: SUR-422 (cross-repo umbrella). Companion: SUR-421
  (plugin-extraction re-eval, 2026-11-15).
- Files most affected: `GATING.md`, `prompts/personas/**`,
  `CLAUDE.md` (appended "Gating policy" section).
- Companion artefact (outside the repo): the handoff brief
  `HANDOFF-to-claude-code.md` and `Compound-vs-Gated-Engineering.md`.
- Related learnings: `surfc/docs/learnings/2026-05-14-introducing-gating-policy.md`
  (the seed entry from the `surfc/` deployment — this is its sibling).
