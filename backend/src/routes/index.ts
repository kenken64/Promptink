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
import { db } from "../db"
import { config } from "../config"
import { existsSync, readFileSync, readdirSync, statSync } from "fs"
import { join } from "path"

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

// Health check endpoint for Railway
const healthRoutes = {
  "/api/health": {
    GET: () => {
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
    },
  },
}

export const routes = {
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
}
