const CACHE_NAME = "iptv-player-v1"
const STATIC_CACHE = "iptv-static-v1"
const DYNAMIC_CACHE = "iptv-dynamic-v1"
const IMAGE_CACHE = "iptv-images-v1"
const API_CACHE = "iptv-api-v1"

// Assets to cache on install
const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/favicon.ico",
  "/_next/static/css/app/layout.css",
  "/_next/static/chunks/webpack.js",
  "/_next/static/chunks/main.js",
  "/_next/static/chunks/pages/_app.js",
]

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...")

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("Caching static assets")
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log("Static assets cached")
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error("Failed to cache static assets:", error)
      }),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...")

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== STATIC_CACHE &&
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== IMAGE_CACHE &&
              cacheName !== API_CACHE
            ) {
              console.log("Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => {
        console.log("Service Worker activated")
        return self.clients.claim()
      }),
  )
})

// Fetch event - handle requests with different strategies
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") {
    return
  }

  // Skip chrome-extension requests
  if (url.protocol === "chrome-extension:") {
    return
  }

  // Handle different types of requests
  if (url.pathname.startsWith("/_next/static/")) {
    // Static assets - cache first
    event.respondWith(cacheFirst(request, STATIC_CACHE))
  } else if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
    // Images - stale while revalidate
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE))
  } else if (url.pathname.endsWith(".m3u") || url.pathname.endsWith(".m3u8") || url.pathname.endsWith(".xml")) {
    // Playlists and EPG - network first with cache fallback
    event.respondWith(networkFirst(request, API_CACHE))
  } else if (url.pathname.startsWith("/api/")) {
    // API calls - network first
    event.respondWith(networkFirst(request, API_CACHE))
  } else {
    // HTML pages - network first with offline fallback
    event.respondWith(networkFirstWithOffline(request, DYNAMIC_CACHE))
  }
})

// Cache strategies
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    console.error("Cache first strategy failed:", error)
    return new Response("Network error", { status: 408 })
  }
}

async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    console.log("Network failed, trying cache:", error)
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    return new Response("Offline", { status: 503 })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone())
      }
      return networkResponse
    })
    .catch(() => cachedResponse)

  return cachedResponse || fetchPromise
}

async function networkFirstWithOffline(request, cacheName) {
  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    console.log("Network failed, trying cache:", error)
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    // Return offline page for navigation requests
    if (request.mode === "navigate") {
      return caches.match("/offline.html")
    }

    return new Response("Offline", { status: 503 })
  }
}

// Background sync for recordings
self.addEventListener("sync", (event) => {
  console.log("Background sync triggered:", event.tag)

  if (event.tag === "recording-sync") {
    event.waitUntil(syncRecordings())
  } else if (event.tag === "epg-update") {
    event.waitUntil(updateEPG())
  }
})

async function syncRecordings() {
  try {
    console.log("Syncing recordings...")
    // Implement recording sync logic here
    // This would typically involve checking for scheduled recordings
    // and updating their status
  } catch (error) {
    console.error("Recording sync failed:", error)
  }
}

async function updateEPG() {
  try {
    console.log("Updating EPG data...")
    // Implement EPG update logic here
    // This would fetch fresh EPG data and cache it
  } catch (error) {
    console.error("EPG update failed:", error)
  }
}

// Push notifications
self.addEventListener("push", (event) => {
  console.log("Push notification received:", event)

  const options = {
    body: event.data ? event.data.text() : "New notification from IPTV Player",
    icon: "/icon-192x192.png",
    badge: "/badge-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "explore",
        title: "Open App",
        icon: "/icon-192x192.png",
      },
      {
        action: "close",
        title: "Close",
        icon: "/icon-192x192.png",
      },
    ],
  }

  event.waitUntil(self.registration.showNotification("IPTV Player", options))
})

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event)

  event.notification.close()

  if (event.action === "explore") {
    event.waitUntil(clients.openWindow("/"))
  }
})

// Message handling
self.addEventListener("message", (event) => {
  console.log("Message received:", event.data)

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

// Periodic background sync (if supported)
self.addEventListener("periodicsync", (event) => {
  console.log("Periodic sync triggered:", event.tag)

  if (event.tag === "epg-update") {
    event.waitUntil(updateEPG())
  }
})

// Cache management - clean up old entries
async function cleanupCaches() {
  const cacheNames = await caches.keys()

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName)
    const requests = await cache.keys()

    // Remove entries older than 7 days
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    for (const request of requests) {
      const response = await cache.match(request)
      if (response) {
        const dateHeader = response.headers.get("date")
        if (dateHeader) {
          const responseDate = new Date(dateHeader).getTime()
          if (responseDate < oneWeekAgo) {
            await cache.delete(request)
            console.log("Deleted old cache entry:", request.url)
          }
        }
      }
    }
  }
}

// Run cleanup periodically
setInterval(cleanupCaches, 24 * 60 * 60 * 1000) // Once per day
