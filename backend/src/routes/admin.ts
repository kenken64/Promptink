import { config } from "../config"
import { db } from "../db"
import { log } from "../utils"

const ADMIN_JWT_SECRET = config.admin.jwtSecret
const ADMIN_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

// Simple base64 encode/decode for JWT
function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString("base64url")
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf-8")
}

// Simple HMAC signature using Web Crypto
async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data))
  return Buffer.from(signature).toString("base64url")
}

// Generate admin JWT token
async function generateAdminToken(): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payload = base64UrlEncode(JSON.stringify({
    role: "admin",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + ADMIN_TOKEN_EXPIRY_MS) / 1000),
  }))
  const signature = await sign(`${header}.${payload}`, ADMIN_JWT_SECRET)
  return `${header}.${payload}.${signature}`
}

// Verify admin JWT token
async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return false

    const header = parts[0]
    const payload = parts[1]
    const signature = parts[2]
    
    if (!header || !payload || !signature) return false
    
    const expectedSignature = await sign(`${header}.${payload}`, ADMIN_JWT_SECRET)
    
    if (signature !== expectedSignature) return false

    const payloadData = JSON.parse(base64UrlDecode(payload))
    
    if (payloadData.role !== "admin") return false
    if (payloadData.exp < Math.floor(Date.now() / 1000)) return false

    return true
  } catch {
    return false
  }
}

// Middleware to check admin auth
async function requireAdminAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  const token = authHeader.slice(7)
  const isValid = await verifyAdminToken(token)
  
  if (!isValid) {
    return Response.json({ error: "Invalid or expired admin token" }, { status: 401 })
  }
  
  return null // Auth passed
}

// Get admin stats from database
function getAdminStats() {
  const userCount = db.query("SELECT COUNT(*) as count FROM users").get() as { count: number }
  const imageCount = db.query("SELECT COUNT(*) as count FROM generated_images").get() as { count: number }
  const orderCount = db.query("SELECT COUNT(*) as count FROM orders WHERE status = 'paid'").get() as { count: number }
  const activeSubscriptions = db.query("SELECT COUNT(*) as count FROM users WHERE subscription_status = 'active'").get() as { count: number }
  
  return {
    totalUsers: userCount?.count || 0,
    totalImages: imageCount?.count || 0,
    paidOrders: orderCount?.count || 0,
    activeSubscriptions: activeSubscriptions?.count || 0,
  }
}

export const adminRoutes = {
  // Admin login
  "/api/admin/login": {
    POST: async (req: Request) => {
      try {
        const body = await req.json() as { password?: string }
        const { password } = body

        if (!password) {
          return Response.json({ error: "Password is required" }, { status: 400 })
        }

        if (password !== config.admin.password) {
          log("WARN", "Failed admin login attempt")
          return Response.json({ error: "Invalid password" }, { status: 401 })
        }

        const token = await generateAdminToken()
        log("INFO", "Admin logged in successfully")
        
        return Response.json({ token })
      } catch (error) {
        log("ERROR", "Admin login error", error)
        return Response.json({ error: "Login failed" }, { status: 500 })
      }
    },
  },

  // Get admin stats
  "/api/admin/stats": {
    GET: async (req: Request) => {
      const authError = await requireAdminAuth(req)
      if (authError) return authError

      try {
        const stats = getAdminStats()
        return Response.json(stats)
      } catch (error) {
        log("ERROR", "Failed to get admin stats", error)
        return Response.json({ error: "Failed to get stats" }, { status: 500 })
      }
    },
  },

  // Verify admin token
  "/api/admin/verify": {
    GET: async (req: Request) => {
      const authError = await requireAdminAuth(req)
      if (authError) return authError
      
      return Response.json({ valid: true })
    },
  },
}
