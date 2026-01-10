import { config } from "./config"
import { log } from "./utils"
import { routes } from "./routes"
import { initDatabase } from "./db"
import index from "../../frontend/index.html"

// Initialize database
initDatabase()

const isDev = process.env.NODE_ENV !== "production"
log("INFO", `Environment: ${process.env.NODE_ENV || "development"}, isDev: ${isDev}`)

Bun.serve({
  port: config.server.port,
  routes: {
    "/": index,
    ...routes,
  },
  fetch(req) {
    const url = new URL(req.url)
    log("INFO", `${req.method} ${url.pathname}`)
    return new Response("Not Found", { status: 404 })
  },
  // Only enable development features in non-production
  ...(isDev ? { development: { hmr: true, console: true } } : {}),
})

log("INFO", `TRMNL Backend running on http://localhost:${config.server.port}`)
log("INFO", `Device MAC: ${config.trmnl.macAddress}`)
log("INFO", `Device API: ${config.trmnl.deviceApiKey ? "configured" : "missing"}`)
log("INFO", `User API: ${config.trmnl.userApiKey ? "configured" : "not configured"}`)
