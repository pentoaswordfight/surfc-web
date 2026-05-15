# AGENTS.md — surfc-web

Agent / Codex-side context for the **surfc-web** marketing site. The
primary, fuller agent context is in [`CLAUDE.md`](CLAUDE.md) (architecture,
the Cross-repo contracts table, auth-aware pricing hydration, Termly
consent, fonts, CI). Read that first. This file adds the gating policy.

## Gating policy

This repo follows the Gated / Conducted Engineering pattern documented in
[`GATING.md`](GATING.md). Path-typed gates apply: spine paths require
founder sign-off; surface paths are gated by named personas in
`prompts/personas/`. After merge, draft an entry in `docs/learnings/` per
the template.

Cross-repo contracts in this repo (cookie `sb-surfc-access`, Stripe
checkout, signup deep-link, UTM passthrough, PostHog) are listed in
`CLAUDE.md` → "Cross-repo contracts." Any change to those contracts
requires a matching change in the `surfc/` repo and a `cross-repo` Linear
label.

There is no `.codex/skills/` directory in this repo today. If one is
added, skills must defer to `GATING.md` when their suggested action would
touch a spine path; skill output that proposes a spine change must include
the named-persona invocation as part of its plan.
