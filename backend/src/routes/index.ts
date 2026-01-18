import { displayRoutes } from "./display"
import { pluginRoutes } from "./plugins"
import { deviceRoutes } from "./device"
import { imageRoutes } from "./images"
import { syncRoutes } from "./sync"
import { authRoutes } from "./auth"
import { settingsRoutes } from "./settings"
import { orderRoutes } from "./orders"
import { subscriptionRoutes } from "./subscription"
import { razorpayWebhookRoutes } from "./razorpay-webhook"
import { shareRoutes } from "./share"
import { galleryRoutes } from "./gallery"
import { suggestionsRoutes } from "./suggestions"
import { scheduleRoutes } from "./schedule"
import { batchRoutes } from "./batch"
import { speechRoutes } from "./speech"
import { db } from "../db"
import { config } from "../config"
import { existsSync, readFileSync, readdirSync, statSync } from "fs"
import { join } from "path"
import { withAuth } from "../middleware/auth"
import { authLimiter, generateLimiter, apiLimiter, speechLimiter, getRateLimitStats } from "../middleware/rate-limit"

type RouteHandler = (req: Request, ...args: any[]) => Promise<Response> | Response
type RouteDefinition = { [method: string]: RouteHandler }
type Routes = { [path: string]: RouteDefinition }

/**
 * Add security headers to all responses
 */
function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  const isDev = process.env.NODE_ENV !== "production"

  // Content Security Policy
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' https://checkout.razorpay.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com; " +
    "frame-src https://api.razorpay.com https://checkout.razorpay.com; " +
    "frame-ancestors 'none'"
  )

  // Prevent clickjacking
  headers.set("X-Frame-Options", "DENY")

  // Prevent MIME type sniffing
  headers.set("X-Content-Type-Options", "nosniff")

  // Referrer policy
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions policy
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

/**
 * Apply rate limiting to routes based on path patterns
 */
function applyRateLimiting(routes: Routes): Routes {
  const rateLimitedRoutes: Routes = {}

  for (const [path, methods] of Object.entries(routes)) {
    const rateLimitedMethods: RouteDefinition = {}

    for (const [method, handler] of Object.entries(methods)) {
      // Determine which rate limiter(s) to apply based on path
      if (path.startsWith("/api/auth/")) {
        // Auth endpoints: strict rate limiting (5 req / 15 min)
        rateLimitedMethods[method] = async (req: Request, ...args: any[]) => {
          const limitResponse = await authLimiter(req)
          if (limitResponse) return addSecurityHeaders(limitResponse)
          const response = await handler(req, ...args)
          return addSecurityHeaders(response)
        }
      } else if (path === "/api/images/generate" || path === "/api/images/edit") {
        // Image generation: cost control (5 req / min)
        rateLimitedMethods[method] = async (req: Request, ...args: any[]) => {
          const limitResponse = await generateLimiter(req)
          if (limitResponse) return addSecurityHeaders(limitResponse)
          const response = await handler(req, ...args)
          return addSecurityHeaders(response)
        }
      } else if (path === "/api/speech/transcribe") {
        // Speech transcription: Whisper API cost control (10 req / min)
        rateLimitedMethods[method] = async (req: Request, ...args: any[]) => {
          const limitResponse = await speechLimiter(req)
          if (limitResponse) return addSecurityHeaders(limitResponse)
          const response = await handler(req, ...args)
          return addSecurityHeaders(response)
        }
      } else if (path.startsWith("/api/") && path !== "/api/health") {
        // General API endpoints: DDoS protection (100 req / min)
        // Skip health check for Railway uptime monitoring
        rateLimitedMethods[method] = async (req: Request, ...args: any[]) => {
          const limitResponse = await apiLimiter(req)
          if (limitResponse) return addSecurityHeaders(limitResponse)
          const response = await handler(req, ...args)
          return addSecurityHeaders(response)
        }
      } else {
        // No rate limiting (health check, non-API routes) - still add security headers
        rateLimitedMethods[method] = async (req: Request, ...args: any[]) => {
          const response = await handler(req, ...args)
          return addSecurityHeaders(response)
        }
      }
    }

    rateLimitedRoutes[path] = rateLimitedMethods
  }

  return rateLimitedRoutes
}

// Helper to recursively list files in a directory
function listFilesRecursive(dir: string, baseDir: string = dir): { path: string; size: number; isDir: boolean }[] {
  const results: { path: string; size: number; isDir: boolean }[] = []
  
  if (!existsSync(dir)) {
    return results
  }

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const relativePath = fullPath.replace(baseDir, "").replace(/^[\/\\]/, "")
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          results.push({ path: relativePath + "/", size: 0, isDir: true })
          // Recursively list subdirectory contents
          const subFiles = listFilesRecursive(fullPath, baseDir)
          results.push(...subFiles)
        } else {
          results.push({ path: relativePath, size: stat.size, isDir: false })
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Can't read directory
  }

  return results
}

// Health check endpoint for Railway (basic - no auth required for Railway health checks)
const healthRoutes = {
  "/api/health": {
    GET: () => {
      return Response.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      })
    },
  },

  // Detailed health/debug endpoint (protected - requires authentication)
  "/api/health/details": {
    GET: withAuth(async (req, user) => {
      // Get user count for debugging
      let userCount = 0
      try {
        const result = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }
        userCount = result?.count || 0
      } catch (e) {
        // Table might not exist yet
      }

      // Check volume status
      const dataDir = "/app/data"
      const markerFile = join(dataDir, ".volume-marker")
      let volumeStatus = "unknown"
      let volumeInfo = null
      
      if (existsSync(markerFile)) {
        try {
          volumeInfo = JSON.parse(readFileSync(markerFile, "utf-8"))
          volumeStatus = "healthy"
        } catch {
          volumeStatus = "marker-corrupt"
        }
      } else if (existsSync(dataDir)) {
        volumeStatus = "no-marker"
      } else {
        volumeStatus = "not-mounted"
      }

      // List files in data directory
      const files = listFilesRecursive(dataDir)
      const totalSize = files.reduce((sum, f) => sum + f.size, 0)

      return Response.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        dbPath: process.env.DB_PATH || "./data/promptink.db",
        jwtConfigured: !!process.env.JWT_SECRET,
        userCount,
        requestedBy: { id: user.id, email: user.email },
        rateLimits: {
          auth: getRateLimitStats("auth"),
          generate: getRateLimitStats("generate"),
          api: getRateLimitStats("api"),
        },
        volume: {
          status: volumeStatus,
          info: volumeInfo,
          imagesDir: config.storage.imagesDir,
          imagesDirExists: existsSync(config.storage.imagesDir),
          files: files,
          totalFiles: files.filter(f => !f.isDir).length,
          totalSize: totalSize,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(2) + " MB",
        },
      })
    }),
  },
}

// Combine all routes and apply rate limiting
const allRoutes = {
  ...healthRoutes,
  ...displayRoutes,
  ...pluginRoutes,
  ...deviceRoutes,
  ...imageRoutes,
  ...syncRoutes,
  ...authRoutes,
  ...settingsRoutes,
  ...orderRoutes,
  ...subscriptionRoutes,
  ...razorpayWebhookRoutes,
  ...shareRoutes,
  ...galleryRoutes,
  ...suggestionsRoutes,
  ...scheduleRoutes,
  ...batchRoutes,
  ...speechRoutes,
}

// Export routes without rate limiting (rate limiting disabled)
export const routes = allRoutes
