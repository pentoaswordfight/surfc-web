# Personas — review prompts for the gating gate (surfc-web)

This directory holds the named reviewer personas referenced in
`GATING.md` §3. Each persona is a one-page brief that turns an agent into
a focused reviewer for a specific class of failure on the **surfc-web**
marketing site.

Personas are *additive* to the founder gate, not a replacement. For
**spine** paths they run as the fallback gate **before** founder sign-off.
For **surface** paths they compose into the CE gate (the founder reads the
report, not the diff).

This site has **no server**, **no unit tests**, and **no linter** — the
only automated gates are Playwright (`playwright.yml`) and the Lychee
linkcheck (`quality.yml`); Lighthouse is disabled (SUR-254). That makes
the persona gates carry more weight here than runtime CI does for several
spine paths (pricing claims, blog claims, SEO, perf). Treat the persona
report as a real safety net, not a formality.

---

## How to invoke a persona

### 1. Inline in chat

> *"Adopt the `auth-bridge-reviewer` persona from
> `prompts/personas/auth-bridge-reviewer.md`. Review the changes in
> `<branch / PR / file>`. Produce a report against your findings
> template."*

### 2. As a subagent brief

When using the Task / Agent tool, paste the persona file's content as the
agent's system brief, then attach the diff and the ticket. Ask for the
report verbatim.

### 3. As a slash command (future)

Register a slash command per persona that loads the file and prompts for
the diff. Not yet wired up.

---

## The personas

### New personas (surfc-web-specific) — drafted in the SUR-422 grounding pass

| Persona | What it gates | File |
|---|---|---|
| `auth-bridge-reviewer` | `src/lib/auth.ts`, `src/lib/checkout.ts`, `src/lib/appUrl.ts`, the pricing hydration block, and the PostHog/`[data-cta]` analytics wiring (the cross-domain handoff to `app.surfc.app`) | [auth-bridge-reviewer.md](auth-bridge-reviewer.md) |
| `pricing-claim-reviewer` | Pricing copy (`src/components/Pricing*.astro`, `src/pages/pricing.astro`) against the entitlements SSoT in `surfc/supabase/functions/_shared/entitlements.ts` | [pricing-claim-reviewer.md](pricing-claim-reviewer.md) |
| `legal-copy-reviewer` | `src/pages/policies/{privacy,terms}.astro`, the Termly embed + consent gating | [legal-copy-reviewer.md](legal-copy-reviewer.md) |
| `blog-claim-reviewer` | Privacy / security / capability / architecture claims in `src/content/blog/*.mdx` against current `surfc/` reality | [blog-claim-reviewer.md](blog-claim-reviewer.md) |
| `perf-budget-reviewer` | `lighthouserc.cjs`, `src/styles/fonts.css`, dependencies, scripts, images — perf budget (SUR-227 fonts, SUR-254 Lighthouse) | [perf-budget-reviewer.md](perf-budget-reviewer.md) |
| `seo-reviewer` | `robots.txt`, sitemap config, OG/meta, RSS, the `/waitlist` noindex sunset page (SUR-365) | [seo-reviewer.md](seo-reviewer.md) |

### Reusable personas (adapted from `surfc/prompts/personas/`)

These compose into the CE gate per `GATING.md` §4.

| Persona | What it gates | File |
|---|---|---|
| `regression-reviewer` | Behavioural regressions, missing Playwright coverage, build breaks, draft leakage, dev/preview divergence. Default-on for every change. | [regression-reviewer.md](regression-reviewer.md) |
| `ux-reviewer` | Pattern/token divergence, missing loading/error/empty states, accessibility, mobile/desktop parity, Termly-banner collisions, internal jargon in copy | [ux-reviewer.md](ux-reviewer.md) |
| `naming-reviewer` | New public names — shared Surfc vocabulary, internal jargon leakage, the v1.5 tier-name landmine, mislabelled actions | [naming-reviewer.md](naming-reviewer.md) |

The three reusable personas were adapted (not copied verbatim): the
`surfc/` originals carry React/PWA/crypto/Supabase context that is
actively wrong for a static Astro site. The shared parts — the
report shape, the public vocabulary table, and the
`'free' | 'pro'` → Reader/Annotator/Syntopist tier-name landmine — are
preserved. Each adapted file notes its provenance at the top.

Not applicable here (live only in `surfc/`): `crypto-reviewer`,
`migration-reviewer`, `billing-reviewer`, `prompt-regression-reviewer`,
`sync-reviewer`, and the full `security-reviewer` (its relevant subset —
analytics payloads, third-party domains, env handling — is folded into
`auth-bridge-reviewer`).

---

## Shared report format

Every persona's report follows the same shape so it scans in 60 seconds.
The persona file restates the format inline so each is self-contained; the
canonical version is here:

```
## <persona-name> review report

**Change under review:** <branch / PR / commit / files>
**Date:** <YYYY-MM-DD>
**Persona version:** <git short SHA of the persona file>

### Findings

For each finding:

- **[BLOCKER | CONCERN | NIT]** — One-line summary
  - **Why it matters:** 1–3 sentences.
  - **Where:** file:line or path glob.
  - **Suggested resolution:** terse — what changes, not how.

If no findings in a class, say so explicitly: "No BLOCKERs." /
"No CONCERNs." / "No NITs."

### Out-of-scope observations

Anything noticed but not in this persona's remit. Do not block. List with
file:line.

### Verdict

One of:
- **PASS** — no BLOCKERs; founder may sign off.
- **PASS WITH CONCERNS** — no BLOCKERs but CONCERNs require explicit
  founder acknowledgement before sign-off.
- **HOLD** — at least one BLOCKER. Change does not merge until resolved.
```

---

## Severity classes — meaning

- **BLOCKER** — if shipped, the change creates a state the persona's
  threat model rules out: a broken auth handoff, a false pricing/product
  claim, a consent bypass, a site-wide deindex, a perf collapse, a build
  break. Halts the merge.
- **CONCERN** — likely a real issue but reasonable people may disagree on
  severity. Founder must explicitly accept in writing before merge.
- **NIT** — small, optional. Does not block.

A persona that produces only descriptive prose with no severity calls is
not doing its job.

---

## Versioning

These prompts are meta/spine per `GATING.md` §3.3 — they go through the
GCE founder gate. Edit them in PRs. Cite the persona file's commit SHA in
review reports so future-you knows which version was applied.

---

*Last updated: 2026-05-15 (SUR-422 per-repo grounding pass).*
