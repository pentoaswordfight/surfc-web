# Contributing — surfc-web

Commits follow **Conventional Commits**; reference the Linear ticket in
the subject (e.g. `fix(analytics): … [SUR-367]`). Branch naming follows
the in-flight convention (e.g. `chore/sur-422-introduce-gating-policy`).

See [`CLAUDE.md`](CLAUDE.md) for architecture, commands, and the
Cross-repo contracts table, and [`GATING.md`](GATING.md) for the
path-typed review policy.

## Review policy

This repo uses the Gated / Conducted Engineering pattern documented in
[`GATING.md`](GATING.md). Before opening a PR:

1. Identify which class your change falls under: spine (GCE-only) or
   surface (CE). Use `GATING.md` §3 / §5 if unsure.
2. **For spine:** pressure-test the design in the Linear ticket, then
   implement, then run the named persona in `prompts/personas/<name>.md`
   as the fallback gate. Founder sign-off is required.
3. **For surface:** run the CE persona pass — `regression-reviewer`
   always; `ux-reviewer` if visible; `naming-reviewer` if new public
   names. Attach the persona report(s) to the PR description.
4. After merge, draft a `docs/learnings/YYYY-MM-DD-<slug>.md` entry per
   the template. Skip only for trivial changes (typos, deps, formatting).

CI gates already in place: `playwright.yml` (Chromium + mobile-chrome) and
`quality.yml linkcheck`. These are runtime gates and remain authoritative
for "does the change actually work." The persona gates are decision-time
gates — additive, not a replacement. (Lighthouse CI is disabled pending
SUR-254 cleanup; until it returns, `perf-budget-reviewer` is the only perf
gate.)

## Worktree convention

Hold concurrent threads in separate worktrees rather than
context-switching one branch:

```bash
git worktree add ../surfc-web-<feature-slug> <branch-name>
```

Naming: `../surfc-web-<feature-slug>` (e.g. `../surfc-web-pricing-rename`).
Clean up with `git worktree remove ../<path>` once the branch lands. Each
worktree has its own `node_modules` — `npm install` separately.
