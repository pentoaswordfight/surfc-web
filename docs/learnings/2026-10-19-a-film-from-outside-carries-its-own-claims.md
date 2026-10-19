---
date: 2026-10-19
ticket: SUR-1228
area: [perf, ui, claims]
gate: GCE
verdict: PASS WITH CONCERNS
artefacts_updated:
  - tests/how-it-works.spec.ts
  - video/README.md
---

# A film from outside the repo carries its own claims, its own branding and its own bytes

## What happened

`/how-it-works/` swapped SUR-1221's two app films for one NotebookLM video overview. The film came
finished: a watermark on every frame, a NotebookLM end card, 40.6 MB, and narration nobody on the team
wrote. `video/` now makes such a film ready (mask, crop, end card, encode, poster, captions) instead of
making one.

## What surprised me

- **The words were the risk, not the pixels.** The narration and its on-screen cards claim more than the
  guide's privacy table: "the boundaries around your data are absolute", "External AI — BLOCKED", a sweep
  that "scrubs out" card numbers the app only flags for review. The page's `BANNED` pattern let every one
  of them through, because it lists the guide's known overclaims, not a generator's new ones. The founder
  kept the film; a note under it now says the guide is right where they differ.
- **A rectangle is the wrong shape for a watermark.** `delogo` interpolates from the box edge, so a dot of
  the paper grid on that edge became a grey streak across the corner in some scenes. A mask of the mark's
  own pixels (the median over a frame a second, where the pictures blur out and the still watermark stays
  sharp) with `removelogo` left the grid alone.
- **NotebookLM's frame has black edges** (two rows at the top, four at the bottom), which the rounded player
  turned into a hairline and a bar. A crop to 16:9 and a scale back, with `setsar=1`: without it, ffmpeg
  kept the 0.05% difference as non-square pixels.
- **The index every page view fetches is mostly sample tables.** At 30 fps and 48 kHz sound the `moov` was
  297 KB; no B-frames and 24 kHz sound made it 153 KB, for a smaller film overall.
- **LCP moved for a reason that was not the film.** Interleaved runs (5 pairs, DevTools throttling) put the
  median LCP at 1.66 s before and 1.95 s after, with fewer bytes after. The poster is the LCP element, and
  a 230–335 ms main-thread task (the page's own style and layout) starts at about 1.5 s. The old 32 KiB
  poster usually landed just before it; the new 45 KiB one usually lands just after and waits. The base lost
  that race in 2 runs of 5 too. A static `preload="metadata"` was the first suspect and measured as no
  different from `none`.

## What the gate caught

The correctness reviewer found that the recipe never made `out/` (my end-to-end run reused an existing one)
and that the end card could be screenshot before its background decoded. The claim and ux reviewers asked
for the note to say which source is right, and to say "iPhone" now that no Android film sits beside it.
The perf reviewer pointed at the `moov` sample tables. The ux reviewer's tap-target concern did not hold:
a link inside a sentence is exempt.

## What to compound

- `tests/how-it-works.spec.ts` pins the film's box size, the WebP poster, the 25 MiB limit (from the Range
  response), the note's correction and its `#private` target. Each was mutation-checked.
- `video/README.md` records the source's SHA-256, runs from an empty `out/`, and explains the encode
  settings that keep the index small.
- Follow-ups for the founder: a claim pass for any outside film before it goes up (its narration and its
  on-screen text), and the page's ~300 ms style-and-layout task, which decides whether the poster paints
  at 1.6 s or 1.9 s.

## References

- Linear ticket: SUR-1228
- Files most affected: `src/pages/how-it-works.astro`, `tests/how-it-works.spec.ts`, `video/`
- Related learnings: `2026-10-15-video-on-a-static-page-fetches-and-shifts.md`
