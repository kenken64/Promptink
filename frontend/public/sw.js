// PromptInk Service Worker
const CACHE_NAME = 'promptink-v1'
const IMAGE_CACHE_NAME = 'promptink-images-v1'
const API_CACHE_NAME = 'promptink-api-v1'

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
          .filter((name) => {
            // Keep current caches
            return name !== CACHE_NAME && 
                   name !== IMAGE_CACHE_NAME && 
                   name !== API_CACHE_NAME
          })
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

// Check if URL is a gallery image
function isGalleryImage(url) {
  return url.pathname.startsWith('/api/gallery/image/') ||
         url.pathname.startsWith('/api/gallery/thumbnail/')
}

// Check if URL is a cacheable API endpoint
function isCacheableAPI(url) {
  // Cache gallery list API for offline browsing
  return url.pathname === '/api/gallery' ||
         url.pathname.startsWith('/api/gallery?')
}

// Fetch event - handle different caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip external requests
  if (url.origin !== self.location.origin) return

  // Strategy 1: Cache-first for gallery images (they don't change)
  if (isGalleryImage(url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving cached image:', url.pathname)
            return cachedResponse
          }
          
          // Fetch and cache
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone())
              console.log('[SW] Cached image:', url.pathname)
            }
            return response
          }).catch(() => {
            // Return placeholder for offline
            return new Response('Image not available offline', { status: 503 })
          })
        })
      })
    )
    return
  }

  // Strategy 2: Network-first with cache fallback for gallery API
  if (isCacheableAPI(url)) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              // Cache the API response
              cache.put(request, response.clone())
              console.log('[SW] Cached API response:', url.pathname)
            }
            return response
          })
          .catch(() => {
            // Network failed, try cache
            console.log('[SW] Network failed, trying cache for:', url.pathname)
            return cache.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                // Add header to indicate this is from cache
                const headers = new Headers(cachedResponse.headers)
                headers.set('X-From-Cache', 'true')
                return new Response(cachedResponse.body, {
                  status: cachedResponse.status,
                  statusText: cachedResponse.statusText,
                  headers
                })
              }
              return new Response(JSON.stringify({ 
                error: 'You are offline', 
                offline: true,
                images: [] 
              }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              })
            })
          })
      })
    )
    return
  }

  // Skip other API requests - always go to network
  if (url.pathname.startsWith('/api/')) return

  // Strategy 3: Network-first for static assets
  event.respondWith(
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
  
  // Allow app to request cache clearing
  if (event.data === 'clearImageCache') {
    caches.delete(IMAGE_CACHE_NAME).then(() => {
      console.log('[SW] Image cache cleared')
    })
  }
})
