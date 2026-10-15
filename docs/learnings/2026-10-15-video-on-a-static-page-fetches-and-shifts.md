---
date: 2026-10-15
ticket: SUR-1221
area: [perf, ui, a11y]
gate: GCE
verdict: PASS WITH CONCERNS
artefacts_updated:
  - tests/how-it-works.spec.ts
  - video/README.md
---

# Two videos on a static page: what "preload", an early paint and a restored radio each cost

## What happened

`/how-it-works/` gained two walkthrough films, one per app, with a radio switch that shows one at a time
(CSS `:has()`) and a tiny inline script that picks the Android film on an Android phone. Everything looked
right in a fast local preview; four costs only showed up under review, throttling or real browsers.

## What surprised me

- **`preload="metadata"` is not small in Chromium.** It reads about 320 KiB on a throttled phone and up to
  1 MiB on a fast link per film — the `moov` atom alone is ~230 KB for a 3:40 film. Lighthouse in simulate
  mode reports the media request at a few hundred bytes, so "total byte weight" hides it entirely; only a
  DevTools-throttled run or a server-side count shows it. A hidden film with `preload="metadata"` pays it
  for nothing: the hidden one now stays `none` until it is shown.
- **The first paint can land mid-parse.** Under throttling, Chrome painted after the two `<video>` elements
  and before the radios existed. With no radio checked, neither `:has(:checked)` rule matched, both films
  showed, and the page shifted (CLS 0.122, 1 run in 6). The fix is a default state: the iPhone film holds the
  slot until the Android radio is checked (`:not(:has([value="android"]:checked))`).
- **Chrome restores a radio after an inline script has run, without a `change` event.** After Back
  navigation, the restored choice showed one film with the other film's preload. `autocomplete="off"` on the
  radios stops the restore, so the script's choice always stands.
- **A video poster as LCP reads badly in Lantern.** The poster (32 KB WebP) painted at 198 ms observed, yet
  simulated mobile LCP went from 1.8 s to 3.2 s: Lantern pulls every request that starts before the observed
  LCP into its graph. A poster preload with `fetchpriority=high` changed nothing (Lantern ignores priority).
  DevTools throttling gives the real figure: about 1.7 s.
- **Vite inlines a file under 4 KB as a `data:` URL, even with `?url`.** A captions file is that small;
  `?url&no-inline` keeps it a real file.
- **Playwright's Chromium cannot play H.264.** Play/pause had to be checked in Edge, and the test proves
  "switching pauses the film put away" with a stand-in `pause()`.

## What the gate caught

The perf-budget reviewer found the mid-parse double film and the hidden byte cost; the ux reviewer found the
restored-radio state and that the chosen pill vanished in forced colours (its fill is the only mark); the
claim reviewer found an absolute ("Every note is filed under ideas") and a stronger-than-approved privacy
wording ("never used") in the voice lines both films share; the founder kept both and changed only "any
app's share button" on screen. None was in the brief.

## What to compound

- `tests/how-it-works.spec.ts` pins the default state with no radio checked, the preload of each film and
  the pause on switch; each was mutation-checked.
- Follow-up for `prompts/personas/perf-budget-reviewer.md`: add media to the hunt list — measure
  `preload` bytes with throttling (not simulate mode), and treat a poster LCP regression as Lantern-suspect
  until a throttled run confirms it. Founder's call.

## References

- Linear ticket: SUR-1221
- Files most affected: `src/pages/how-it-works.astro`, `src/styles/guide.css`, `video/`
- Related learnings: `2026-10-14-guide-privacy-table-understated-server.md`
