/**
 * Tiny Node HTTP fixture that mimics the waitlist-signup Edge Function's CORS
 * contract. Used by the Playwright spec so the waitlist form can execute a
 * real cross-origin POST (with the full CORS response-header round-trip) in CI
 * — page.route() mocks bypass the network stack entirely and were blind to the
 * SUR-218 allow-headers regression.
 *
 * Surfaces:
 *   OPTIONS /waitlist-signup            — preflight. Allow-headers mirrors the
 *                                         Edge Function's `corsHeaders()` output,
 *                                         including `apikey`.
 *   POST    /waitlist-signup            — returns {status: "success"} with CORS.
 *   GET     /__cors-fixture/health      — 200 readiness probe for Playwright's
 *                                         webServer.url.
 *   POST    /__cors-fixture/inspect     — returns the headers of the most recent
 *                                         /waitlist-signup request (lets specs
 *                                         assert the browser forwarded apikey,
 *                                         content-type, etc).
 *
 * Started by Playwright's webServer. [SUR-218]
 */

import http from 'node:http'

const PORT = Number(process.env.CORS_FIXTURE_PORT ?? 5179)

// The last request the fixture saw at /waitlist-signup. Specs use this to
// assert the browser sent what they expected (e.g. the apikey header) —
// resilient to whether the browser actually ran a separate preflight or
// reused a cached one.
let lastWaitlistRequest = null

function applyCors(req, res, extra = {}) {
  const origin = req.headers.origin ?? '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  for (const [key, value] of Object.entries(extra)) res.setHeader(key, value)
}

function recordWaitlistRequest(req) {
  lastWaitlistRequest = {
    method:  req.method ?? 'UNKNOWN',
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : (v ?? '')]),
    ),
    receivedAt: Date.now(),
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (url.pathname === '/waitlist-signup') {
    recordWaitlistRequest(req)

    if (req.method === 'OPTIONS') {
      // Mirrors the surfc repo's handler.ts corsHeaders() exactly. Keep this
      // list in lock-step — if the Edge Function's allow-headers grows, this
      // fixture should grow too so the client-form test stays representative.
      applyCors(req, res, {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
        'Access-Control-Max-Age':       '0',
      })
      res.statusCode = 204
      res.end()
      return
    }

    if (req.method === 'POST') {
      applyCors(req, res)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ status: 'success' }))
      return
    }
  }

  if (req.method === 'GET' && url.pathname === '/__cors-fixture/health') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (req.method === 'POST' && url.pathname === '/__cors-fixture/inspect') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ lastWaitlistRequest }))
    return
  }

  res.statusCode = 404
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`cors-fixture listening on http://127.0.0.1:${PORT}`)
})
