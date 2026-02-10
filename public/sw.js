/* ============================================================
   Service Worker — Offline-first caching for Hospital OR Scheduler
   Strategies:
   - App Shell: Cache-first for static assets (JS, CSS, images)
   - API: Network-first with fallback to cache for data fetches
   - Pages: Stale-while-revalidate for HTML navigation
   ============================================================ */

const CACHE_NAME = "medscheduler-v2";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/schedule",
  "/surgeries",
  "/offline",
];

// Install: pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some routes may fail during install, that's ok
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== "GET") return;

  // Skip Supabase auth/realtime requests
  if (url.hostname.includes("supabase")) return;

  // Skip chrome-extension, etc.
  if (!url.protocol.startsWith("http")) return;

  // Static assets: cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation & page requests: network-first with cache fallback
  if (event.request.mode === "navigate" || event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || caches.match("/");
          });
        })
    );
    return;
  }

  // API/data requests: network-first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Background Sync: process pending surgery operations
self.addEventListener("sync", (event) => {
  if (event.tag === "medscheduler-sync") {
    event.waitUntil(processPendingSync());
  }
});

async function processPendingSync() {
  // Open IndexedDB to get pending items
  const request = indexedDB.open("medscheduler-offline", 2);
  return new Promise((resolve) => {
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pendingSync", "readwrite");
      const store = tx.objectStore("pendingSync");
      const getAll = store.getAll();
      getAll.onsuccess = () => {
        const items = getAll.result;
        if (!items.length) {
          resolve(undefined);
          return;
        }
        // Notify clients that sync is happening
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "SYNC_STATUS",
              pendingCount: items.length,
              status: "syncing",
            });
          });
        });
        resolve(undefined);
      };
    };
    request.onerror = () => resolve(undefined);
  });
}
