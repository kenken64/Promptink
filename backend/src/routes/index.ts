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

      return Response.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        dbPath: process.env.DB_PATH || "./data/promptink.db",
        jwtConfigured: !!process.env.JWT_SECRET,
        userCount,
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
