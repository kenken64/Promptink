import { displayRoutes } from "./display"
import { pluginRoutes } from "./plugins"
import { deviceRoutes } from "./device"
import { imageRoutes } from "./images"
import { syncRoutes } from "./sync"
import { authRoutes } from "./auth"
import { settingsRoutes } from "./settings"

// Health check endpoint for Railway
const healthRoutes = {
  "/api/health": {
    GET: () => Response.json({ status: "ok", timestamp: new Date().toISOString() }),
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
}
