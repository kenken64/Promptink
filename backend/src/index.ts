import { config } from "./config"
import { log } from "./utils"
import { routes } from "./routes"
import { initDatabase } from "./db"
import { startScheduler } from "./services/scheduler-service"
import { startBatchProcessor } from "./services/batch-service"
import { join } from "path"
import { existsSync, mkdirSync, statSync, writeFileSync, readFileSync } from "fs"

// Verify volume persistence (critical for production data)
function verifyVolumePersistence() {
  const dataDir = "/app/data"
  const markerFile = join(dataDir, ".volume-marker")
  const imagesDir = config.storage.imagesDir
  
  if (process.env.NODE_ENV !== "production") {
    log("INFO", "Skipping volume check in development mode")
    return
  }

  // Check if data directory exists
  if (!existsSync(dataDir)) {
    log("WARN", "⚠️ Data directory does not exist! Volume may not be mounted.", { dataDir })
    mkdirSync(dataDir, { recursive: true })
  }

  // Check for volume marker file
  const now = new Date().toISOString()
  if (existsSync(markerFile)) {
    try {
      const markerContent = readFileSync(markerFile, "utf-8")
      const markerData = JSON.parse(markerContent)
      log("INFO", "✓ Volume persistence verified", { 
        createdAt: markerData.createdAt,
        lastBoot: markerData.lastBoot,
        bootCount: markerData.bootCount + 1
      })
      // Update marker
      markerData.lastBoot = now
      markerData.bootCount = (markerData.bootCount || 0) + 1
      writeFileSync(markerFile, JSON.stringify(markerData, null, 2))
    } catch (e) {
      log("WARN", "Failed to read volume marker", e)
    }
  } else {
    // First boot or volume was reset
    log("WARN", "⚠️ Volume marker not found - this may be a fresh volume or data was lost!")
    try {
      const markerData = { createdAt: now, lastBoot: now, bootCount: 1 }
      writeFileSync(markerFile, JSON.stringify(markerData, null, 2))
      log("INFO", "Created new volume marker")
    } catch (e) {
      log("ERROR", "❌ Cannot write to volume! Data will NOT persist across deployments!", e)
    }
  }

  // Ensure images directory exists
  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true })
    log("INFO", "Created images directory", { imagesDir })
  }

  // Check if we can write to the volume
  try {
    const testFile = join(dataDir, ".write-test")
    writeFileSync(testFile, "test")
    log("INFO", "✓ Volume is writable")
  } catch (e) {
    log("ERROR", "❌ Volume is NOT writable! Images will NOT be saved!", e)
  }
}

// Verify volume before initializing database
verifyVolumePersistence()

// Initialize database
initDatabase()

// Start the scheduler service
startScheduler()

// Start the batch processor service
startBatchProcessor()

const isDev = process.env.NODE_ENV !== "production"
log("INFO", `Environment: ${process.env.NODE_ENV || "development"}, isDev: ${isDev}`)

// Security headers function
function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)

  // Content Security Policy
  // Note: 'unsafe-inline' for styles is needed for React inline styles
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none'"
  )

  // Prevent clickjacking
  headers.set("X-Frame-Options", "DENY")

  // Prevent MIME type sniffing
  headers.set("X-Content-Type-Options", "nosniff")

  // Enable XSS protection
  headers.set("X-XSS-Protection", "1; mode=block")

  // Referrer policy
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions policy (formerly Feature-Policy)
  headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

  // HSTS (only in production over HTTPS)
  if (!isDev) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

if (isDev) {
  // Development: use Bun's HTML import with HMR
  const index = await import("../../frontend/index.html")

  Bun.serve({
    port: config.server.port,
    routes: {
      "/": index.default,
      ...routes,
    },
    fetch(req) {
      const url = new URL(req.url)
      log("INFO", `${req.method} ${url.pathname}`)
      const response = new Response("Not Found", { status: 404 })
      return addSecurityHeaders(response)
    },
    development: true,
  })
} else {
  // Production: serve pre-built static files
  const frontendDist = join(import.meta.dir, "../../frontend/dist")
  const indexHtml = await Bun.file(join(import.meta.dir, "../../frontend/index.prod.html")).text()
  const stylesCSS = await Bun.file(join(frontendDist, "styles.css")).text()

  Bun.serve({
    port: config.server.port,
    routes: {
      ...routes,
    },
    async fetch(req) {
      const url = new URL(req.url)
      log("INFO", `${req.method} ${url.pathname}`)

      // Serve index.html for root
      if (url.pathname === "/" || url.pathname === "/index.html") {
        const response = new Response(indexHtml, {
          headers: { "Content-Type": "text/html" },
        })
        return addSecurityHeaders(response)
      }

      // Serve CSS
      if (url.pathname === "/assets/styles.css") {
        const response = new Response(stylesCSS, {
          headers: { "Content-Type": "text/css" },
        })
        return addSecurityHeaders(response)
      }

      // Serve static assets from dist folder
      if (url.pathname.startsWith("/assets/")) {
        const filePath = join(frontendDist, url.pathname.replace("/assets/", ""))
        const file = Bun.file(filePath)
        if (await file.exists()) {
          // Determine content type based on file extension
          let contentType = "application/octet-stream"
          if (url.pathname.endsWith(".js")) {
            contentType = "application/javascript"
          } else if (url.pathname.endsWith(".png")) {
            contentType = "image/png"
          } else if (url.pathname.endsWith(".jpg") || url.pathname.endsWith(".jpeg")) {
            contentType = "image/jpeg"
          } else if (url.pathname.endsWith(".svg")) {
            contentType = "image/svg+xml"
          } else if (url.pathname.endsWith(".gif")) {
            contentType = "image/gif"
          } else if (url.pathname.endsWith(".webp")) {
            contentType = "image/webp"
          }
          const response = new Response(file, {
            headers: { "Content-Type": contentType },
          })
          return addSecurityHeaders(response)
        }
      }

      // SPA fallback - serve index.html for unmatched routes
      if (!url.pathname.startsWith("/api/")) {
        const response = new Response(indexHtml, {
          headers: { "Content-Type": "text/html" },
        })
        return addSecurityHeaders(response)
      }

      const response = new Response("Not Found", { status: 404 })
      return addSecurityHeaders(response)
    },
  })
}

log("INFO", `TRMNL Backend running on http://localhost:${config.server.port}`)
log("INFO", `Device MAC: ${config.trmnl.macAddress}`)
log("INFO", `Device API: ${config.trmnl.deviceApiKey ? "configured" : "missing"}`)
log("INFO", `User API: ${config.trmnl.userApiKey ? "configured" : "not configured"}`)
