/*
 * Kill-switch service worker — evicts the stale Surfc PWA worker left on the
 * marketing origins (notably braird.app) from before the rebrand.
 *
 * Background: braird.app briefly served the Surfc app (a PWA), which registered
 * a Workbox service worker at `/sw.js` (scope `/`, see surfc's
 * registerServiceWorker.js). The marketing site (this deployment) registers no
 * service worker, but that stale worker persists in visitors' browsers and
 * hijacks navigations — a plain reload gets served the old cached app shell and
 * redirected to /signin. A hard refresh bypasses it; a normal one doesn't.
 *
 * A registered worker keeps re-fetching its own script URL (`/sw.js`) to check
 * for updates — roughly on navigation, capped at every 24h. Before this file
 * existed the fetch fell through to the SPA HTML fallback (text/html), an
 * invalid worker script, so the update failed and the old worker lived on. This
 * file makes that update-check return a valid script that, on activation, drops
 * all caches, unregisters itself, and reloads open tabs so they fall back to the
 * network — worker-free. Browsers with no existing `/sw.js` registration never
 * fetch this, so fresh visitors are unaffected.
 *
 * ponytail: self-destructing worker, canonical pattern. It caches nothing and
 * intercepts nothing — its only job is to remove itself and its predecessor.
 */

self.addEventListener('install', () => {
  // Activate immediately instead of waiting for the old worker's clients to close.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache the old app worker precached (stale app shell, assets).
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      } catch {
        // Best-effort; unregister regardless of cache-clear success.
      }

      await self.registration.unregister()

      // Reload any open tabs so they re-fetch from the network without a worker.
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        try {
          client.navigate(client.url)
        } catch {
          // A client we can't navigate will pick up the change on its next load.
        }
      }
    })(),
  )
})
