// PromptInk Service Worker
const CACHE_NAME = 'promptink-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dist/index.js',
  '/dist/styles.css',
  '/public/favicon.svg',
  '/public/manifest.json'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets')
      return cache.addAll(STATIC_ASSETS)
    })
  )
  // Activate immediately
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    })
  )
  // Take control of all pages immediately
  self.clients.claim()
})

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API requests - always go to network
  if (url.pathname.startsWith('/api/')) return

  // Skip external requests
  if (url.origin !== self.location.origin) return

  event.respondWith(
    // Try network first
    fetch(request)
      .then((response) => {
        // Clone response to cache it
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse
          }
          // If not in cache, return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/')
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }
})
