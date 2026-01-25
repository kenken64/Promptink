import { config } from "../config"
import { db, userDeviceQueries, type UserDevice } from "../db"
import { log, toISODate } from "../utils"
import { readdir, stat } from "node:fs/promises"
import { join, relative } from "node:path"
import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs"

const DATA_DIR = "/app/data"

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

// Fetch OpenAI usage and costs data
async function getOpenAIUsage(): Promise<{
  images: { total: number; byModel: Record<string, number>; bySize: Record<string, number> }
  costs: { total: number; currency: string; byLineItem: Record<string, number> }
  completions: { inputTokens: number; outputTokens: number; requests: number }
  period: { start: string; end: string }
  error?: string
}> {
  const adminKey = config.openai.adminKey
  
  log("DEBUG", "OpenAI Admin Key check", { 
    hasKey: !!adminKey, 
    keyLength: adminKey?.length || 0,
    keyPrefix: adminKey?.substring(0, 10) || "none"
  })
  
  if (!adminKey) {
    return {
      images: { total: 0, byModel: {}, bySize: {} },
      costs: { total: 0, currency: "usd", byLineItem: {} },
      completions: { inputTokens: 0, outputTokens: 0, requests: 0 },
      period: { start: "", end: "" },
      error: "OPENAI_ADMIN_KEY not configured",
    }
  }

  // Get start of current month
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startTime = Math.floor(startOfMonth.getTime() / 1000)
  const endTime = Math.floor(now.getTime() / 1000)

  const headers = {
    "Authorization": `Bearer ${adminKey}`,
    "Content-Type": "application/json",
  }

  try {
    // Fetch images usage
    const imagesResponse = await fetch(
      `https://api.openai.com/v1/organization/usage/images?start_time=${startTime}&end_time=${endTime}&group_by=model&group_by=size&limit=31`,
      { headers }
    )
    
    // Fetch costs
    const costsResponse = await fetch(
      `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}&group_by=line_item&limit=31`,
      { headers }
    )

    // Fetch completions usage (for GPT usage tracking)
    const completionsResponse = await fetch(
      `https://api.openai.com/v1/organization/usage/completions?start_time=${startTime}&end_time=${endTime}&limit=31`,
      { headers }
    )

    const result = {
      images: { total: 0, byModel: {} as Record<string, number>, bySize: {} as Record<string, number> },
      costs: { total: 0, currency: "usd", byLineItem: {} as Record<string, number> },
      completions: { inputTokens: 0, outputTokens: 0, requests: 0 },
      period: { 
        start: startOfMonth.toISOString().split("T")[0]!, 
        end: now.toISOString().split("T")[0]!
      },
    }

    // Process images data
    if (imagesResponse.ok) {
      const imagesData = await imagesResponse.json() as { 
        data?: Array<{ results?: Array<{ images?: number; model?: string; size?: string }> }> 
      }
      
      for (const bucket of imagesData.data || []) {
        for (const r of bucket.results || []) {
          result.images.total += r.images || 0
          if (r.model) {
            result.images.byModel[r.model] = (result.images.byModel[r.model] || 0) + (r.images || 0)
          }
          if (r.size) {
            result.images.bySize[r.size] = (result.images.bySize[r.size] || 0) + (r.images || 0)
          }
        }
      }
    } else {
      log("WARN", "Failed to fetch OpenAI images usage", { status: imagesResponse.status })
    }

    // Process costs data
    if (costsResponse.ok) {
      const costsData = await costsResponse.json() as { 
        data?: Array<{ results?: Array<{ amount?: { value?: number; currency?: string }; line_item?: string }> }> 
      }
      
      for (const bucket of costsData.data || []) {
        for (const r of bucket.results || []) {
          const amount = r.amount?.value || 0
          result.costs.total += amount
          result.costs.currency = r.amount?.currency || "usd"
          if (r.line_item) {
            result.costs.byLineItem[r.line_item] = (result.costs.byLineItem[r.line_item] || 0) + amount
          }
        }
      }
      result.costs.total = Math.round(result.costs.total * 100) / 100 // Round to 2 decimals
    } else {
      log("WARN", "Failed to fetch OpenAI costs", { status: costsResponse.status })
    }

    // Process completions data
    if (completionsResponse.ok) {
      const completionsData = await completionsResponse.json() as { 
        data?: Array<{ results?: Array<{ input_tokens?: number; output_tokens?: number; num_model_requests?: number }> }> 
      }
      
      for (const bucket of completionsData.data || []) {
        for (const r of bucket.results || []) {
          result.completions.inputTokens += r.input_tokens || 0
          result.completions.outputTokens += r.output_tokens || 0
          result.completions.requests += r.num_model_requests || 0
        }
      }
    } else {
      log("WARN", "Failed to fetch OpenAI completions usage", { status: completionsResponse.status })
    }

    return result
  } catch (error) {
    log("ERROR", "Failed to fetch OpenAI usage data", error)
    return {
      images: { total: 0, byModel: {}, bySize: {} },
      costs: { total: 0, currency: "usd", byLineItem: {} },
      completions: { inputTokens: 0, outputTokens: 0, requests: 0 },
      period: { start: "", end: "" },
      error: String(error),
    }
  }
}

// Get paginated users list
function getPaginatedUsers(page: number, limit: number) {
  const offset = (page - 1) * limit
  
  const totalResult = db.query("SELECT COUNT(*) as count FROM users").get() as { count: number }
  const total = totalResult?.count || 0
  
  const users = db.query(`
    SELECT 
      id, 
      email, 
      name, 
      subscription_status,
      created_at
    FROM users 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Array<{
    id: number
    email: string
    name: string | null
    subscription_status: string | null
    created_at: string
  }>
  
  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
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

  // Get OpenAI usage and costs
  "/api/admin/openai-usage": {
    GET: async (req: Request) => {
      const authError = await requireAdminAuth(req)
      if (authError) return authError

      try {
        const usage = await getOpenAIUsage()
        return Response.json(usage)
      } catch (error) {
        log("ERROR", "Failed to get OpenAI usage", error)
        return Response.json({ error: "Failed to get OpenAI usage" }, { status: 500 })
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

  // Get paginated users list
  "/api/admin/users": {
    GET: async (req: Request) => {
      const authError = await requireAdminAuth(req)
      if (authError) return authError

      try {
        const url = new URL(req.url)
        const page = parseInt(url.searchParams.get("page") || "1", 10)
        const limit = parseInt(url.searchParams.get("limit") || "20", 10)
        
        // Validate page and limit
        const validPage = Math.max(1, page)
        const validLimit = Math.min(Math.max(1, limit), 100) // Max 100 per page
        
        const result = getPaginatedUsers(validPage, validLimit)
        return Response.json(result)
      } catch (error) {
        log("ERROR", "Failed to get users list", error)
        return Response.json({ error: "Failed to get users" }, { status: 500 })
      }
    },
  },

  // Export data as zip
  "/api/admin/export": {
    GET: async (req: Request) => {
      const authError = await requireAdminAuth(req)
      if (authError) return authError

      try {
        // Close database connections to ensure data integrity
        log("INFO", "Starting data export")
        
        // Get all files recursively
        const files: { path: string; relativePath: string }[] = []
        
        async function collectFiles(dir: string) {
          if (!existsSync(dir)) return
          
          const entries = await readdir(dir, { withFileTypes: true })
          for (const entry of entries) {
            const fullPath = join(dir, entry.name)
            if (entry.isDirectory()) {
              await collectFiles(fullPath)
            } else {
              files.push({
                path: fullPath,
                relativePath: relative(DATA_DIR, fullPath),
              })
            }
          }
        }
        
        await collectFiles(DATA_DIR)
        
        if (files.length === 0) {
          return Response.json({ error: "No data to export" }, { status: 404 })
        }

        // Create zip entries
        const zipEntries: Record<string, Uint8Array> = {}
        
        for (const file of files) {
          const content = await Bun.file(file.path).arrayBuffer()
          zipEntries[file.relativePath] = new Uint8Array(content)
        }
        
        // Simple ZIP file creation (no compression, stored only)
        const zipBuffer = createZipBuffer(zipEntries)
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
        const filename = `promptink-backup-${timestamp}.zip`
        
        log("INFO", `Data export completed: ${files.length} files`)
        
        return new Response(zipBuffer, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": zipBuffer.byteLength.toString(),
          },
        })
      } catch (error) {
        log("ERROR", "Failed to export data", error)
        return Response.json({ error: "Failed to export data" }, { status: 500 })
      }
    },
  },

  // Import data from zip
  "/api/admin/import": {
    POST: async (req: Request) => {
      const authError = await requireAdminAuth(req)
      if (authError) return authError

      try {
        const formData = await req.formData()
        const file = formData.get("file") as File | null
        const oldUrl = formData.get("oldUrl") as string | null
        const newUrl = formData.get("newUrl") as string | null
        
        if (!file) {
          return Response.json({ error: "No file provided" }, { status: 400 })
        }
        
        if (!file.name.endsWith(".zip")) {
          return Response.json({ error: "File must be a .zip file" }, { status: 400 })
        }

        log("INFO", `Starting data import: ${file.name}`)
        if (oldUrl && newUrl) {
          log("INFO", `URL migration: ${oldUrl} -> ${newUrl}`)
        }
        
        const zipBuffer = await file.arrayBuffer()
        const entries = parseZipBuffer(new Uint8Array(zipBuffer))
        
        // Ensure data directory exists
        if (!existsSync(DATA_DIR)) {
          mkdirSync(DATA_DIR, { recursive: true })
        }
        
        let filesRestored = 0
        
        for (const [relativePath, content] of Object.entries(entries)) {
          const fullPath = join(DATA_DIR, relativePath)
          const dir = fullPath.substring(0, fullPath.lastIndexOf("/"))
          
          if (dir && !existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
          }
          
          await Bun.write(fullPath, content)
          filesRestored++
        }
        
        log("INFO", `Data import completed: ${filesRestored} files restored`)
        
        // Perform URL migration if both old and new URLs are provided
        let urlsUpdated = 0
        if (oldUrl && newUrl && oldUrl.trim() && newUrl.trim()) {
          urlsUpdated = migrateUrls(oldUrl.trim(), newUrl.trim())
          log("INFO", `URL migration completed: ${urlsUpdated} URLs updated`)
        }
        
        return Response.json({ 
          success: true, 
          message: `Successfully restored ${filesRestored} files${urlsUpdated > 0 ? ` and updated ${urlsUpdated} URLs` : ""}`,
          filesRestored,
          urlsUpdated,
        })
      } catch (error) {
        log("ERROR", "Failed to import data", error)
        return Response.json({ error: "Failed to import data" }, { status: 500 })
      }
    },
  },

  // Get devices for a specific user (admin)
  "/api/admin/users/:userId/devices": {
    GET: async (req: Request) => {
      const authError = await requireAdminAuth(req)
      if (authError) return authError

      try {
        const url = new URL(req.url)
        const pathParts = url.pathname.split("/")
        const userId = parseInt(pathParts[pathParts.length - 2] || "0", 10)

        if (isNaN(userId)) {
          return Response.json({ error: "Invalid user ID" }, { status: 400 })
        }

        const devices = userDeviceQueries.findAllByUserId.all(userId)
        return Response.json({
          devices: devices.map(d => ({
            id: d.id,
            name: d.name,
            webhook_url: d.webhook_uuid,
            background_color: d.background_color,
            is_default: d.is_default === 1,
            mac_address: d.mac_address,
            device_api_key: d.device_api_key,
            created_at: toISODate(d.created_at),
            updated_at: toISODate(d.updated_at),
          })),
        })
      } catch (error) {
        log("ERROR", "Failed to fetch user devices", error)
        return Response.json({ error: "Failed to fetch devices" }, { status: 500 })
      }
    },

    POST: async (req: Request) => {
      const authError = await requireAdminAuth(req)
      if (authError) return authError

      try {
        const url = new URL(req.url)
        const pathParts = url.pathname.split("/")
        const userId = parseInt(pathParts[pathParts.length - 2] || "0", 10)

        if (isNaN(userId)) {
          return Response.json({ error: "Invalid user ID" }, { status: 400 })
        }

        const body = await req.json() as {
          name: string
          webhook_url?: string
          background_color?: "black" | "white"
          is_default?: boolean
          mac_address?: string
          device_api_key?: string
        }

        if (!body.name?.trim()) {
          return Response.json({ error: "Device name is required" }, { status: 400 })
        }

        const existingCount = userDeviceQueries.countByUserId.get(userId)
        const isDefault = existingCount?.count === 0 || body.is_default === true

        if (isDefault) {
          userDeviceQueries.clearDefault.run(userId)
        }

        const device = userDeviceQueries.create.get(
          userId,
          body.name.trim(),
          body.webhook_url?.trim() || "",
          body.background_color || "black",
          isDefault ? 1 : 0,
          body.mac_address?.trim() || null,
          body.device_api_key?.trim() || null
        )

        if (!device) {
          return Response.json({ error: "Failed to create device" }, { status: 500 })
        }

        log("INFO", "Admin created device", { userId, deviceId: device.id })

        return Response.json({
          success: true,
          device: {
            id: device.id,
            name: device.name,
            webhook_url: device.webhook_uuid,
            background_color: device.background_color,
            is_default: device.is_default === 1,
            mac_address: device.mac_address,
            device_api_key: device.device_api_key,
            created_at: toISODate(device.created_at),
            updated_at: toISODate(device.updated_at),
          },
        })
      } catch (error) {
        log("ERROR", "Failed to create device", error)
        return Response.json({ error: "Failed to create device" }, { status: 500 })
      }
    },
  },

  // Update or delete a specific device (admin)
  "/api/admin/devices/:deviceId": {
    PUT: async (req: Request) => {
      const authError = await requireAdminAuth(req)
      if (authError) return authError

      try {
        const url = new URL(req.url)
        const deviceId = parseInt(url.pathname.split("/").pop() || "0", 10)

        if (isNaN(deviceId)) {
          return Response.json({ error: "Invalid device ID" }, { status: 400 })
        }

        const device = userDeviceQueries.findById.get(deviceId)
        if (!device) {
          return Response.json({ error: "Device not found" }, { status: 404 })
        }

        const body = await req.json() as {
          name?: string
          webhook_url?: string
          background_color?: "black" | "white"
          is_default?: boolean
          mac_address?: string | null
          device_api_key?: string | null
        }

        const newName = body.name?.trim() || device.name
        const newWebhookUrl = body.webhook_url?.trim() ?? device.webhook_uuid
        const newBackgroundColor = body.background_color || device.background_color
        const newMacAddress = body.mac_address !== undefined ? (body.mac_address?.trim() || null) : device.mac_address
        const newDeviceApiKey = body.device_api_key !== undefined ? (body.device_api_key?.trim() || null) : device.device_api_key

        userDeviceQueries.update.run(newName, newWebhookUrl, newBackgroundColor, newMacAddress, newDeviceApiKey, deviceId)

        if (body.is_default === true) {
          userDeviceQueries.clearDefault.run(device.user_id)
          userDeviceQueries.setDefault.run(deviceId, device.user_id)
        }

        const updatedDevice = userDeviceQueries.findById.get(deviceId)

        log("INFO", "Admin updated device", { deviceId })

        return Response.json({
          success: true,
          device: updatedDevice ? {
            id: updatedDevice.id,
            name: updatedDevice.name,
            webhook_url: updatedDevice.webhook_uuid,
            background_color: updatedDevice.background_color,
            is_default: updatedDevice.is_default === 1,
            mac_address: updatedDevice.mac_address,
            device_api_key: updatedDevice.device_api_key,
            created_at: toISODate(updatedDevice.created_at),
            updated_at: toISODate(updatedDevice.updated_at),
          } : null,
        })
      } catch (error) {
        log("ERROR", "Failed to update device", error)
        return Response.json({ error: "Failed to update device" }, { status: 500 })
      }
    },

    DELETE: async (req: Request) => {
      const authError = await requireAdminAuth(req)
      if (authError) return authError

      try {
        const url = new URL(req.url)
        const deviceId = parseInt(url.pathname.split("/").pop() || "0", 10)

        if (isNaN(deviceId)) {
          return Response.json({ error: "Invalid device ID" }, { status: 400 })
        }

        const device = userDeviceQueries.findById.get(deviceId)
        if (!device) {
          return Response.json({ error: "Device not found" }, { status: 404 })
        }

        const wasDefault = device.is_default === 1
        const userId = device.user_id

        userDeviceQueries.delete.run(deviceId, userId)

        if (wasDefault) {
          const remainingDevices = userDeviceQueries.findAllByUserId.all(userId)
          if (remainingDevices.length > 0 && remainingDevices[0]) {
            userDeviceQueries.setDefault.run(remainingDevices[0].id, userId)
          }
        }

        log("INFO", "Admin deleted device", { deviceId, userId })

        return Response.json({
          success: true,
          message: "Device deleted successfully",
        })
      } catch (error) {
        log("ERROR", "Failed to delete device", error)
        return Response.json({ error: "Failed to delete device" }, { status: 500 })
      }
    },
  },
}

// Migrate URLs in database tables
function migrateUrls(oldUrl: string, newUrl: string): number {
  let totalUpdated = 0
  
  // Update generated_images table
  const generatedImagesResult = db.run(
    "UPDATE generated_images SET image_url = REPLACE(image_url, ?, ?) WHERE image_url LIKE ?",
    [oldUrl, newUrl, `%${oldUrl}%`]
  )
  totalUpdated += generatedImagesResult.changes
  
  // Update synced_images table
  const syncedImagesResult = db.run(
    "UPDATE synced_images SET image_url = REPLACE(image_url, ?, ?) WHERE image_url LIKE ?",
    [oldUrl, newUrl, `%${oldUrl}%`]
  )
  totalUpdated += syncedImagesResult.changes
  
  // Update orders table tracking_url if exists
  try {
    const ordersResult = db.run(
      "UPDATE orders SET tracking_url = REPLACE(tracking_url, ?, ?) WHERE tracking_url LIKE ?",
      [oldUrl, newUrl, `%${oldUrl}%`]
    )
    totalUpdated += ordersResult.changes
  } catch {
    // Table might not have tracking_url column
  }
  
  return totalUpdated
}

// Simple ZIP file creation (no external dependencies)
function createZipBuffer(files: Record<string, Uint8Array>): Uint8Array {
  const entries: { name: Uint8Array; data: Uint8Array; offset: number }[] = []
  const chunks: Uint8Array[] = []
  let offset = 0
  
  const encoder = new TextEncoder()
  
  for (const [name, data] of Object.entries(files)) {
    const nameBytes = encoder.encode(name)
    const crc = crc32(data)
    
    // Local file header
    const header = new Uint8Array(30 + nameBytes.length)
    const view = new DataView(header.buffer)
    
    view.setUint32(0, 0x04034b50, true) // Local file header signature
    view.setUint16(4, 20, true) // Version needed
    view.setUint16(6, 0, true) // General purpose bit flag
    view.setUint16(8, 0, true) // Compression method (0 = stored)
    view.setUint16(10, 0, true) // File last modification time
    view.setUint16(12, 0, true) // File last modification date
    view.setUint32(14, crc, true) // CRC-32
    view.setUint32(18, data.length, true) // Compressed size
    view.setUint32(22, data.length, true) // Uncompressed size
    view.setUint16(26, nameBytes.length, true) // File name length
    view.setUint16(28, 0, true) // Extra field length
    header.set(nameBytes, 30)
    
    entries.push({ name: nameBytes, data, offset })
    chunks.push(header, data)
    offset += header.length + data.length
  }
  
  // Central directory
  const centralDir: Uint8Array[] = []
  let centralDirSize = 0
  
  for (const entry of entries) {
    const centralHeader = new Uint8Array(46 + entry.name.length)
    const view = new DataView(centralHeader.buffer)
    const crc = crc32(entry.data)
    
    view.setUint32(0, 0x02014b50, true) // Central directory signature
    view.setUint16(4, 20, true) // Version made by
    view.setUint16(6, 20, true) // Version needed
    view.setUint16(8, 0, true) // General purpose bit flag
    view.setUint16(10, 0, true) // Compression method
    view.setUint16(12, 0, true) // File last modification time
    view.setUint16(14, 0, true) // File last modification date
    view.setUint32(16, crc, true) // CRC-32
    view.setUint32(20, entry.data.length, true) // Compressed size
    view.setUint32(24, entry.data.length, true) // Uncompressed size
    view.setUint16(28, entry.name.length, true) // File name length
    view.setUint16(30, 0, true) // Extra field length
    view.setUint16(32, 0, true) // File comment length
    view.setUint16(34, 0, true) // Disk number start
    view.setUint16(36, 0, true) // Internal file attributes
    view.setUint32(38, 0, true) // External file attributes
    view.setUint32(42, entry.offset, true) // Relative offset of local header
    centralHeader.set(entry.name, 46)
    
    centralDir.push(centralHeader)
    centralDirSize += centralHeader.length
  }
  
  chunks.push(...centralDir)
  
  // End of central directory
  const endOfCentralDir = new Uint8Array(22)
  const endView = new DataView(endOfCentralDir.buffer)
  
  endView.setUint32(0, 0x06054b50, true) // End of central directory signature
  endView.setUint16(4, 0, true) // Number of this disk
  endView.setUint16(6, 0, true) // Disk where central directory starts
  endView.setUint16(8, entries.length, true) // Number of central directory records on this disk
  endView.setUint16(10, entries.length, true) // Total number of central directory records
  endView.setUint32(12, centralDirSize, true) // Size of central directory
  endView.setUint32(16, offset, true) // Offset of start of central directory
  endView.setUint16(20, 0, true) // Comment length
  
  chunks.push(endOfCentralDir)
  
  // Combine all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let pos = 0
  for (const chunk of chunks) {
    result.set(chunk, pos)
    pos += chunk.length
  }
  
  return result
}

// Parse ZIP buffer (simple implementation for stored files)
function parseZipBuffer(buffer: Uint8Array): Record<string, Uint8Array> {
  const entries: Record<string, Uint8Array> = {}
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const decoder = new TextDecoder()
  let offset = 0
  
  while (offset < buffer.length - 4) {
    const signature = view.getUint32(offset, true)
    
    if (signature === 0x04034b50) {
      // Local file header
      const compressedSize = view.getUint32(offset + 18, true)
      const fileNameLength = view.getUint16(offset + 26, true)
      const extraFieldLength = view.getUint16(offset + 28, true)
      
      const fileName = decoder.decode(buffer.subarray(offset + 30, offset + 30 + fileNameLength))
      const dataStart = offset + 30 + fileNameLength + extraFieldLength
      const data = buffer.slice(dataStart, dataStart + compressedSize)
      
      if (!fileName.endsWith("/")) {
        entries[fileName] = data
      }
      
      offset = dataStart + compressedSize
    } else if (signature === 0x02014b50 || signature === 0x06054b50) {
      // Central directory or end of central directory - stop parsing
      break
    } else {
      offset++
    }
  }
  
  return entries
}

// CRC-32 calculation
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF
  const table = getCrc32Table()
  
  for (let i = 0; i < data.length; i++) {
    const byte = data[i]!
    const tableIndex = (crc ^ byte) & 0xFF
    crc = (crc >>> 8) ^ table[tableIndex]!
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0
}

let crc32Table: Uint32Array | null = null
function getCrc32Table(): Uint32Array {
  if (crc32Table) return crc32Table
  
  crc32Table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    crc32Table[i] = c
  }
  return crc32Table
}
