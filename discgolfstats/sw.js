// Service worker (open item #9): makes the site installable and usable offline.
//
// - Files of this site: network first, so changes show up right away when online.
//   The cache is only the fallback when offline (or when the network is very slow).
//   That's why the cache name never needs to change after editing the site.
// - Files from CDNs (Bootstrap, Font Awesome, Google Fonts): cache first, they never
//   change for a given URL.
// - The Google Sheet is not handled here: scripts.js keeps the last data in
//   localStorage and shows it when the sheet can't be loaded.

const CACHE = "discgolfstats";

// how long to wait for the network before showing the cached version
const NETWORK_TIMEOUT = 4000;

const SITE_FILES = [
  "./",
  "css/styles.css",
  "js/scripts.js",
  "course_data/hole_lengths.csv",
  "course_data/isomorph_holes.csv",
  "manifest.webmanifest",
  "assets/favicon.ico",
  "assets/icons/icon-192.png",
];

// the same requests the page makes (Font Awesome with crossorigin, Bootstrap without)
const CDN_FILES = [
  ["https://use.fontawesome.com/releases/v6.3.0/js/all.js", "cors"],
  ["https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js", "no-cors"],
  ["https://fonts.googleapis.com/css?family=Montserrat:400,700", "no-cors"],
  ["https://fonts.googleapis.com/css?family=Lato:400,700,400italic,700italic", "no-cors"],
];

const CDN_HOSTS = [
  "use.fontawesome.com",
  "cdn.jsdelivr.net",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdn.startbootstrap.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(SITE_FILES);
      // a CDN file that fails here is cached on its first use instead
      await Promise.allSettled(
        CDN_FILES.map(async ([url, mode]) => cache.put(url, await fetch(url, { mode }))),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
  // everything else (the Google Sheet) goes to the network as usual
});

async function networkFirst(event) {
  const request = event.request;
  const cache = await caches.open(CACHE);
  // ?partie=..., ?spieler=... etc. all show the same page
  const cacheKey = request.mode === "navigate" ? "./" : request;

  const fromNetwork = fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(cache.put(cacheKey, copy));
    }
    return response;
  });

  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT));
  const response = await Promise.race([fromNetwork.catch(() => undefined), timeout]);
  if (response) return response;

  // offline or slow: use the cache, or keep waiting for the network if nothing is cached
  return (await cache.match(cacheKey, { ignoreSearch: true })) ?? fromNetwork;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") cache.put(request, response.clone());
  return response;
}
