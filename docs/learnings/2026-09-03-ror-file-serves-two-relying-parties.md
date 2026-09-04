---
date: 2026-09-03
ticket: SUR-1085
area: [auth-bridge, passkeys, governance, gating]
gate: GCE
verdict: PASS
artefacts_updated:
  - GATING.md
  - CLAUDE.md
  - prompts/personas/auth-bridge-reviewer.md
  - tests/well-known.spec.ts
---

# One build serves three apexes, so `.well-known/webauthn` is the ROR list for two relying parties

## What happened

`app.marginborn.com` had been serving the app for some time — the identical build to
`app.braird.app` — but `braird.app/.well-known/webauthn` listed only `https://app.braird.app`.
`defaultRpId()` returns `braird.app` on that host, and marginborn.com is a different
registrable domain, so every ceremony there needed Related Origin Requests and got a
rejection. `getEncryptionPrfOutput` swallows that as "PRF unavailable", so the symptom was a
vault that would not unlock and no error naming the cause.

The fix is one line of JSON. Everything else in the PR exists because of what the line
revealed.

## What surprised me

**Three things, in increasing order of how wrong I was.**

**The ROR file is not the braird.app file.** One Cloudflare Pages build serves braird.app,
surfc.app *and* marginborn.com from the same `public/` dir — identical ETag on all three. So
that one file is the Related Origin Requests allow-list for **both** relying parties. The
`https://app.braird.app` entry, which I had confidently written off as belt-and-braces
because app.braird.app is a subdomain of its own RP, is what lets `migrateToBrairdRp()`
assert the *legacy surfc.app* passkey from the braird.app origin. It is load-bearing for the
SUR-687 bridge. The code comment beside that call says so plainly; I had reasoned about the
mechanism instead of reading it.

That mattered more than a wrong comment normally would, because I had already written the
claim into `GATING.md`. **A wrong claim in a gate document does not merely misinform — it
reads as permission.** A held PR (#59) was queued to delete this exact file on precisely that
premise.

**`astro preview` cannot serve the URL a browser fetches.** With `trailingSlash: 'always'`,
preview 404s every extensionless path. `/.well-known/webauthn` is unreachable locally; only
`/.well-known/webauthn/` responds. An HTTP test would have had to assert a URL shape
production never serves, and would have looked perfectly reasonable doing it. `/sw.js` works
only because it has an extension.

**The triage list returned a confident wrong answer.** `public/.well-known/*` had no §3 row,
so I ran the §5 triage as designed — and it fell through every item to "None of the above →
Surface, CE". Not because the list was skipped, but because it had no item for the passkey
trust surface. A file whose failure locks every user out of their vault is spine by §1's own
definition.

## What the gate caught

The `auth-bridge-reviewer` pass returned **HOLD on a BLOCKER** and it was the one that
mattered: the redundant-entry claim, caught *after* it had reached GATING.md. The persona had
to be given remit over this path in the same commit it then indicted — the review found the
error in the change that created the reviewer.

`regression-reviewer` returned PASS WITH CONCERNS and caught a real false-pass: the guard read
from `dist/`, and `reuseExistingServer` skips the rebuild whenever a dev server is up, so a
stale build could green a broken source. Now reads `public/` for content, `dist/` only for
"the build copied it".

An over-engineering pass cut a label-budget test whose naive registrable-domain parse failed
**open** on multi-part TLDs — a guard that would hold in the easy case and let the hard one
through. The ceiling became a clause in the gate row instead.

Two verification notes worth keeping. Mutation-testing the guard (drop each origin, delete the
file, remove the header rule, corrupt the JSON) is what proved it guards anything; the first
pass of that battery no-op'd on a drifted working directory and *looked* like it passed. And
`| tail -3 | grep` hid a "2 failed" line, nearly reporting a hole that did not exist. Read the
whole summary.

## What to compound

- **`GATING.md`** — new §3.1 row (GCE only) for the three `.well-known` files, stating that one
  build serves three apexes and naming which relying party each origin serves, so "this entry
  looks redundant" cannot recur. New §5 triage item so the list stops returning Surface for
  this path. The `public/_headers` row now routes its `.well-known` Content-Type rules to
  `auth-bridge-reviewer` rather than `seo-reviewer` — those rules are half the contract.
- **`prompts/personas/auth-bridge-reviewer.md`** — remit over the `.well-known` files plus hunt
  item 12. The framing that earns its keep: the cookie says who the user is, these say which
  origins may assert their passkeys.
- **`CLAUDE.md`** — passkey origin trust added to the cross-repo contracts table, pointing at
  `defaultRpId()`.
- **`tests/well-known.spec.ts`** — mutation-tested guard, with the "why files, not HTTP"
  reasoning recorded so nobody converts it to an HTTP test and hits the 404. States its own
  limit: it catches removal, not omission.

Open honestly: the guards cannot catch a *new* app origin that nobody adds, because the origin
list is a local copy. The ceremony named in the gate row is the only control for that.

## References

- PR / commit: [surfc-web#62](https://github.com/pentoaswordfight/surfc-web/pull/62); PR #59 neutralised by revert
- Linear ticket: SUR-1085 (follow-up SUR-1089 — marginborn.com is not yet a first-class app origin)
- Files most affected: `public/.well-known/webauthn`, `GATING.md`, `tests/well-known.spec.ts`, `prompts/personas/auth-bridge-reviewer.md`
- Related: `surfc/docs/learnings/2026-07-08-sur814-rpid-flip-origin-scoped.md` — same bug class, a live second origin missed when an RP default moved
