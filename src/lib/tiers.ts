// SUR-374 — Single source of truth for user-facing tier *display names*.
//
// The canonical tier identifiers are unchanged and remain `'free' | 'pro'`:
// the entitlements SSoT (`surfc/supabase/functions/_shared/entitlements.ts`),
// PostHog `tier` event properties, `data-cta` strings, and Stripe price IDs
// all keep `free`/`pro`. Only the human-readable label moves —
// Free → Reader, Pro → Annotator. `scholar` is the already-shipped capstone
// (the "Coming Later" card on /pricing); its name is unchanged.
//
// House style (locked in the SUR-374 plan): Title-case proper noun, referred
// to as "the Annotator plan" / "upgrade to Annotator".
//
// This map is duplicated per-repo — `surfc/` ships its own copy (SUR-374
// PR pair). Per `CLAUDE.md`, any tier-name change must land in both repos in
// lockstep until a generated cross-repo source exists.

export const TIER_NAMES = {
  free: 'Reader',
  pro: 'Annotator',
  scholar: 'Scholar',
} as const

export type TierKey = keyof typeof TIER_NAMES
