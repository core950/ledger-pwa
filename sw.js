const CACHE_NAME = "ink-ledger-v17";
const ASSETS = ["./", "index.html", "styles.css?v=17", "app.js?v=17", "manifest.webmanifest", "icon.svg", "reset.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS.map((asset) =>
          fetch(new Request(asset, { cache: "reload" })).then((response) => {
            if (!response.ok) throw new Error(`Failed to cache ${asset}`);
            return cache.put(asset, response);
          }),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || !response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (event.request.mode === "navigate") {
          return (await caches.match("./")) || (await caches.match("index.html")) || Response.redirect("./", 302);
        }

        return new Response("", { status: 503, statusText: "Offline" });
      }),
  );
});
