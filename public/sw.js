const CACHE_PREFIX = "fontaticket-pages-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_BASE = new URL("./", self.registration.scope);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const shellUrl = APP_BASE.href;
    const response = await fetch(shellUrl);
    if (!response.ok) throw new Error(`No se pudo guardar la aplicación para uso sin conexión (${response.status}).`);
    await cache.put(shellUrl, response.clone());
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
      .map((match) => new URL(match[1], APP_BASE).href);
    const staticFiles = [
      "manifest.webmanifest",
      "favicon.svg",
      "icon-192.png",
      "icon-512.png",
      "catalogo-inicial.zip",
    ].map((path) => new URL(path, APP_BASE).href);
    await cache.addAll([...assets, ...staticFiles]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== APP_BASE.origin || !url.href.startsWith(APP_BASE.href)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(APP_BASE.href, response.clone());
        return response;
      } catch {
        return await cache.match(request) || await cache.match(APP_BASE.href);
      }
    })());
    return;
  }

  if (url.pathname === new URL("manifest.webmanifest", APP_BASE).pathname) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw new Error("El manifiesto de FontaTicket no está disponible sin conexión.");
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  })());
});
