const CACHE_NAME = "pockettone-v4";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png"];

// The built JS and CSS have hashed names that only index.html knows, so read them from it and
// precache them too. Otherwise the app could not start offline until a second online visit.
async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
  const html = await (await cache.match("/index.html")).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
  await cache.addAll(assets);
}

function cacheResponse(key, response) {
  // Never cache errors or opaque responses; a cached 404 would be served forever.
  if (response.ok && response.type === "basic") {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(key, copy));
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => cacheResponse("/index.html", response))
        .catch(async () => (await caches.match("/index.html")) ?? Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ??
        fetch(event.request)
          .then((response) => cacheResponse(event.request, response))
          // Falling back to index.html here would hand HTML to a script or image request.
          .catch(() => Response.error()),
    ),
  );
});
