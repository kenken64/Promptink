import { config } from "./config"
import { log } from "./utils"
import { routes } from "./routes"
import { initDatabase } from "./db"
import { join } from "path"

// Initialize database
initDatabase()

const isDev = process.env.NODE_ENV !== "production"
log("INFO", `Environment: ${process.env.NODE_ENV || "development"}, isDev: ${isDev}`)

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
      return new Response("Not Found", { status: 404 })
    },
    development: true,
  })
} else {
  // Production: serve pre-built static files
  const frontendDist = join(import.meta.dir, "../../frontend/dist")
  const indexHtml = await Bun.file(join(import.meta.dir, "../../frontend/index.prod.html")).text()
  const stylesCSS = await Bun.file(join(import.meta.dir, "../../frontend/src/assets/styles.css")).text()

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
        return new Response(indexHtml, {
          headers: { "Content-Type": "text/html" },
        })
      }

      // Serve CSS
      if (url.pathname === "/assets/styles.css") {
        return new Response(stylesCSS, {
          headers: { "Content-Type": "text/css" },
        })
      }

      // Serve JS assets from dist folder
      if (url.pathname.startsWith("/assets/")) {
        const filePath = join(frontendDist, url.pathname.replace("/assets/", ""))
        const file = Bun.file(filePath)
        if (await file.exists()) {
          return new Response(file, {
            headers: {
              "Content-Type": url.pathname.endsWith(".js") ? "application/javascript" : "text/plain"
            },
          })
        }
      }

      // SPA fallback - serve index.html for unmatched routes
      if (!url.pathname.startsWith("/api/")) {
        return new Response(indexHtml, {
          headers: { "Content-Type": "text/html" },
        })
      }

      return new Response("Not Found", { status: 404 })
    },
  })
}

log("INFO", `TRMNL Backend running on http://localhost:${config.server.port}`)
log("INFO", `Device MAC: ${config.trmnl.macAddress}`)
log("INFO", `Device API: ${config.trmnl.deviceApiKey ? "configured" : "missing"}`)
log("INFO", `User API: ${config.trmnl.userApiKey ? "configured" : "not configured"}`)
