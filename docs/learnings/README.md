# docs/learnings — surfc-web

Post-merge learnings for the **surfc-web** marketing site. The compounding
side of the gating policy.

This directory exists because the GCE gate's checklist (`GATING.md` §4)
ends with "a `docs/learnings/` entry is drafted." That step is the one
that turns a single shipped change into an artefact future-you,
future-Claude, and (eventually) future-teammates can compound on.

It is a **curated** log, not an automated one. It is *post-flight
reflection*, distinct from a PR description (what you did) or the
`CLAUDE.md` "Cross-repo contracts" table (the standing contract). Learnings
capture what was *non-obvious* about a change.

This repo has no daily RAID/`update-docs` scheduled flow (those live in the
`surfc/` and `surfc-intranet/` repos). Here the learnings directory is the
*only* compounding artefact — which makes the discipline of writing one
matter more, not less.

---

## When to write an entry

Write one when at least one of the following is true:

1. **Something surprised you.** The change went a way you didn't expect —
   a persona caught something the brief missed, an edge case appeared
   mid-implementation, a "small copy change" turned out to be a spine
   pricing/claim change.
2. **A gate fired with a real finding.** A persona surfaced something that
   mattered, a cross-repo cross-check turned up drift, founder sign-off
   changed the shape. Capturing the catch makes the gate smarter.
3. **A pattern is forming.** Second or third time something like this has
   come up (e.g. repeated tier-name drift, repeated Termly/test-fixture
   friction). The pattern deserves a name.
4. **A "non-obvious" decision was made.** You picked option B over A for a
   reason that wouldn't be obvious from the diff. Future-you needs the
   why.

---

## When NOT to write an entry

Skip if:

- The change is trivial (typo, dependency bump, formatting). The PR
  suffices.
- The change is a routine pattern with no surprises.
- You only have a description of what you did, not a learning. Description
  belongs in the commit message.
- The content would expose secrets, customer data, or anything that
  doesn't survive being read by a future hire.
- You're writing it to "look productive." Empty entries dilute the
  signal.

A good rule: if you can't honestly fill in *What surprised me*, the entry
probably shouldn't exist.

---

## How to write one

1. Copy `_template.md` to `YYYY-MM-DD-<short-slug>.md` in this directory.
2. Fill in the frontmatter and the five sections.
3. Keep it short — five sections, each 1–4 sentences.
4. Commit it as part of the PR that prompted it. The learning lands when
   the change does.

The slug is the topic, not the ticket:
`2026-05-15-grounding-the-gating-skeleton.md`, not
`2026-05-15-sur-422.md`. Slugs make the directory readable without
opening files.

---

## How to read this directory

- **Chronologically** — date prefix sorts latest last; skim the slugs.
- **By area** — `grep -l "area: \[.*pricing.*\]" *.md`.
- **By artefact updated** — `grep -l "GATING.md" *.md` finds every entry
  that touched the gating policy; useful when `GATING.md` drifts.
- **At the quarterly `GATING.md` review** — read this directory in reverse
  chronological order from the last review. Recurring patterns are
  evidence the policy needs editing.

---

## How this compounds (the whole point)

Each entry's *What to compound* section names a concrete artefact change —
a persona update, a `CLAUDE.md` note, a `GATING.md` path correction, a
pressure-test prompt. **An entry without an artefact change to compound on
is suspect.** Either nothing was learned (don't write the entry) or the
learning isn't yet operational (name what would make it so).

If `What to compound: nothing` becomes the modal answer, the gating policy
is over-engineered for this repo's change profile — a meta-learning worth
surfacing at the next quarterly review of `GATING.md`.

---

## Related

- `GATING.md` — the gating policy this directory closes the loop on.
- `prompts/personas/**` — the personas that feed *What the gate caught*.
- `CLAUDE.md` → "Cross-repo contracts" — the standing contract table
  (different artefact: a contract, not a reflection).

---

*Last updated: 2026-05-15.*
