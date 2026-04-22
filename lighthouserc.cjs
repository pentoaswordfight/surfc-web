/**
 * Lighthouse CI configuration — measures the four public marketing pages
 * against a Netlify deploy preview URL supplied by the workflow.
 *
 * Thresholds start as warnings so early runs publish scores without
 * blocking merges. Once we have a stable baseline (~3 PRs of data), the
 * plan is to promote performance/accessibility/seo assertions to "error"
 * in [SUR-218] follow-up work.
 */

module.exports = {
  ci: {
    collect: {
      // URLs are injected by the workflow; this is a fallback for local
      // runs (`npx lhci autorun`) against `astro preview` on :4321.
      url: [
        'http://localhost:4321/',
        'http://localhost:4321/waitlist',
        'http://localhost:4321/policies/privacy',
        'http://localhost:4321/policies/terms',
      ],
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
      },
    },
    // Category-level warnings only — intentionally NOT extending the
    // `lighthouse:recommended` preset. That preset wires dozens of
    // individual audits as `error` (color-contrast, render-blocking,
    // efficient-cache, layout-shift, etc.) which would block CI on
    // pre-existing baseline issues. We surface category scores now and
    // promote individual audits to errors after triaging real issues
    // in follow-up work — matches the "warnings till baseline" plan.
    assert: {
      assertions: {
        'categories:performance':    ['warn', { minScore: 0.9  }],
        'categories:accessibility':  ['warn', { minScore: 0.9  }],
        'categories:best-practices': ['warn', { minScore: 0.9  }],
        'categories:seo':            ['warn', { minScore: 0.95 }],
      },
    },
    upload: {
      // Temporary public storage — rotates results weekly. Switch to a
      // self-hosted LHCI server when the surfc infra grows.
      target: 'temporary-public-storage',
    },
  },
}
