const PICKLESOCIAL_CACHE = "picklesocial-shell-v2";
const LEGACY_CACHE_PREFIX = "xo-pickleball-";
const PICKLESOCIAL_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/config.js",
  "/auth-config.js",
  "/pwa.css",
  "/pwa.js",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PICKLESOCIAL_CACHE)
      .then((cache) => cache.addAll(PICKLESOCIAL_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) =>
          (key.startsWith("picklesocial-") || key.startsWith(LEGACY_CACHE_PREFIX)) &&
          key !== PICKLESOCIAL_CACHE
        )
            .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache Supabase, Turnstile, CDN, or other third-party traffic.
  if (url.origin !== self.location.origin) return;

  // Navigation: network first, app shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(PICKLESOCIAL_CACHE).then((cache) => cache.put("/index.html", copy));
          return res;
        })
        .catch(async () => {
          return (await caches.match("/index.html")) || (await caches.match("/"));
        })
    );
    return;
  }

  // Same-origin static assets: network first so updates arrive quickly,
  // cache fallback so the installed app still opens offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(PICKLESOCIAL_CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
