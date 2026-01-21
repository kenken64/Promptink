import { log } from "../utils"
import { withAuth } from "../middleware/auth"
import { syncedImageQueries, userQueries, userDeviceQueries, type UserDevice } from "../db"
import { config } from "../config"
import { mkdirSync, existsSync } from "fs"
import { join } from "path"

// Get device's background color
function getDeviceBackgroundColor(device: UserDevice): string {
  return device.background_color || "black"
}

// Ensure images directory exists
const IMAGES_DIR = config.storage.imagesDir
if (!existsSync(IMAGES_DIR)) {
  mkdirSync(IMAGES_DIR, { recursive: true })
  log("INFO", "Created images directory", { path: IMAGES_DIR })
}

// Get the file path for a user's synced image
function getUserImagePath(userId: number): string {
  return join(IMAGES_DIR, `user_${userId}.png`)
}

// Get the public URL for a user's synced image
function getUserImageUrl(userId: number): string {
  return `${config.server.baseUrl}/api/images/synced/${userId}`
}

// Download image from URL and save to file
async function downloadAndSaveImage(imageUrl: string, userId: number): Promise<string> {
  log("INFO", "Downloading image", { imageUrl: imageUrl.substring(0, 100) + "...", userId })

  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download image: HTTP ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const filePath = getUserImagePath(userId)

  // Write the image file
  await Bun.write(filePath, arrayBuffer)

  log("INFO", "Image saved to file", {
    userId,
    filePath,
    size: arrayBuffer.byteLength
  })

  return filePath
}

// Send image to a device's webhook URL
async function sendToDeviceWebhook(
  webhookUrl: string,
  imageUrl: string,
  prompt: string,
  backgroundColor: string
): Promise<{ success: boolean; error?: string }> {
  if (!webhookUrl) {
    return { success: false, error: "No webhook URL configured" }
  }

  try {
    const bgHex = backgroundColor === "white" ? "#fff" : "#000"
    log("INFO", "Sending image to device webhook", { webhookUrl, imageUrl, backgroundColor: bgHex })

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merge_variables: {
          has_image: true,
          image_url: imageUrl,
          prompt: prompt,
          background_color: bgHex,
          updated_at: new Date().toISOString(),
        },
      }),
    })

    if (response.ok) {
      log("INFO", "Device webhook updated successfully", { webhookUrl })
      return { success: true }
    } else {
      const errorText = await response.text()
      log("WARN", "Device webhook update failed", { webhookUrl, status: response.status, error: errorText })
      return { success: false, error: `HTTP ${response.status}: ${errorText}` }
    }
  } catch (error) {
    log("ERROR", "Device webhook error", { webhookUrl, error })
    return { success: false, error: String(error) }
  }
}

// Exported helper for programmatic sync (used by scheduler)
export async function syncToTrmnl(
  imageUrl: string,
  prompt: string,
  userId: number,
  deviceIds?: number[]
): Promise<{ success: boolean; error?: string; deviceResults?: Array<{ deviceId: number; success: boolean; error?: string }> }> {
  try {
    // Download and save the image
    await downloadAndSaveImage(imageUrl, userId)

    // Get the permanent URL
    const permanentUrl = getUserImageUrl(userId)

    // Save to database
    syncedImageQueries.create.run(userId, permanentUrl, prompt || null)

    // Get devices to sync to
    let devices: UserDevice[]
    if (deviceIds && deviceIds.length > 0) {
      // Sync to specific devices
      devices = deviceIds
        .map(id => userDeviceQueries.findById.get(id))
        .filter((d): d is UserDevice => d !== null && d !== undefined && d.user_id === userId)
    } else {
      // Sync to all devices with webhook URLs
      devices = userDeviceQueries.findAllByUserId.all(userId).filter(d => d.webhook_uuid)
    }

    if (devices.length === 0) {
      log("WARN", "No devices with webhook URLs to sync to", { userId })
      return { success: true, deviceResults: [] }
    }

    // Send to all device webhooks in parallel
    const results = await Promise.all(
      devices.map(async (device) => {
        if (!device.webhook_uuid) {
          return { deviceId: device.id, success: false, error: "No webhook URL" }
        }
        const result = await sendToDeviceWebhook(
          device.webhook_uuid,
          permanentUrl,
          prompt || "",
          getDeviceBackgroundColor(device)
        )
        return { deviceId: device.id, success: result.success, error: result.error }
      })
    )

    const allSuccess = results.every(r => r.success)
    return { success: allSuccess, deviceResults: results }
  } catch (error) {
    log("ERROR", "syncToTrmnl failed", { userId, error: String(error) })
    return { success: false, error: String(error) }
  }
}

export const syncRoutes = {
  // Sync image - downloads and stores physical copy for TRMNL (authenticated)
  "/api/sync/trmnl": {
    POST: withAuth(async (req, user) => {
      const startTime = performance.now()
      try {
        const text = await req.text()
        const { imageUrl, prompt, deviceIds } = text ? JSON.parse(text) : {}

        if (!imageUrl) {
          return Response.json({ error: "imageUrl is required" }, { status: 400 })
        }

        // Get devices to sync to
        let devices: UserDevice[]
        if (deviceIds && Array.isArray(deviceIds) && deviceIds.length > 0) {
          // Sync to specific devices
          devices = (deviceIds as number[])
            .map(id => userDeviceQueries.findById.get(id))
            .filter((d): d is UserDevice => d !== null && d !== undefined && d.user_id === user.id && !!d.webhook_uuid)
        } else {
          // Sync to all devices with webhook URLs
          devices = userDeviceQueries.findAllByUserId.all(user.id).filter(d => d.webhook_uuid)
        }

        if (devices.length === 0) {
          return Response.json({ error: "No devices with webhook URLs configured" }, { status: 400 })
        }

        log("INFO", "Syncing image for TRMNL", { userId: user.id, deviceCount: devices.length, prompt })

        // Download and save image to file system
        const downloadStart = performance.now()
        let filePath: string
        try {
          filePath = await downloadAndSaveImage(imageUrl, user.id)
        } catch (downloadError) {
          log("ERROR", "Failed to download image", downloadError)
          return Response.json({ error: `Failed to download image: ${String(downloadError)}` }, { status: 500 })
        }
        const downloadTime = performance.now() - downloadStart
        log("INFO", `Image download completed`, { downloadTimeMs: Math.round(downloadTime) })

        // Get permanent URL for this user's image
        const permanentImageUrl = getUserImageUrl(user.id)

        // Store reference in database
        const dbStart = performance.now()
        const syncedImage = syncedImageQueries.create.get(user.id, permanentImageUrl, prompt || null)
        const dbTime = performance.now() - dbStart
        log("INFO", `Database insert completed`, { dbTimeMs: Math.round(dbTime) })

        if (!syncedImage) {
          return Response.json({ error: "Failed to store image reference" }, { status: 500 })
        }

        log("INFO", "Image synced successfully", { userId: user.id, filePath, permanentImageUrl })

        // Send to all device webhooks in parallel
        const webhookStart = performance.now()
        const deviceResults = await Promise.all(
          devices.map(async (device) => {
            const result = await sendToDeviceWebhook(
              device.webhook_uuid!,
              permanentImageUrl,
              prompt || "",
              getDeviceBackgroundColor(device)
            )
            return { 
              deviceId: device.id, 
              deviceName: device.name,
              success: result.success, 
              error: result.error 
            }
          })
        )
        const webhookTime = performance.now() - webhookStart
        log("INFO", `Webhook calls completed`, { webhookTimeMs: Math.round(webhookTime) })

        const totalTime = performance.now() - startTime
        const successCount = deviceResults.filter(r => r.success).length

        log("INFO", `Sync completed`, {
          totalTimeMs: Math.round(totalTime),
          downloadTimeMs: Math.round(downloadTime),
          dbTimeMs: Math.round(dbTime),
          webhookTimeMs: Math.round(webhookTime),
          successCount,
          totalDevices: devices.length
        })

        return Response.json({
          success: successCount > 0,
          message: successCount === devices.length
            ? `Image synced to ${successCount} device${successCount > 1 ? "s" : ""}!`
            : successCount > 0
              ? `Image synced to ${successCount} of ${devices.length} devices`
              : "Failed to sync to any devices",
          syncedAt: syncedImage.synced_at,
          imageUrl: permanentImageUrl,
          deviceResults,
          timing: {
            totalMs: Math.round(totalTime),
            downloadMs: Math.round(downloadTime),
            webhookMs: Math.round(webhookTime),
          },
        })
      } catch (error) {
        log("ERROR", "Failed to sync image", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Serve synced image file (public - for TRMNL to fetch)
  "/api/images/synced/:userId": {
    GET: async (req: Request & { params: { userId: string } }) => {
      try {
        const userId = parseInt(req.params.userId, 10)

        if (isNaN(userId)) {
          return new Response("Invalid user ID", { status: 400 })
        }

        const filePath = getUserImagePath(userId)
        const file = Bun.file(filePath)

        if (!(await file.exists())) {
          return new Response("Image not found", { status: 404 })
        }

        log("INFO", "Serving synced image", { userId, filePath })

        return new Response(file, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        })
      } catch (error) {
        log("ERROR", "Failed to serve image", error)
        return new Response("Internal server error", { status: 500 })
      }
    },
  },

  // TRMNL webhook endpoint - returns the latest synced image info for a specific user (public)
  "/api/trmnl/webhook/:userId": {
    GET: async (req: Request & { params: { userId: string } }) => {
      try {
        const userId = parseInt(req.params.userId, 10)

        if (isNaN(userId)) {
          return Response.json({
            has_image: false,
            message: "Invalid user ID",
          })
        }

        // Verify user exists
        const user = userQueries.findById.get(userId)
        if (!user) {
          return Response.json({
            has_image: false,
            message: "User not found",
          })
        }

        // Check if image file exists
        const filePath = getUserImagePath(userId)
        const file = Bun.file(filePath)

        if (!(await file.exists())) {
          return Response.json({
            has_image: false,
            message: "No image synced yet",
          })
        }

        // Get latest synced image metadata from database
        const latestImage = syncedImageQueries.findLatestByUserId.get(userId)

        log("INFO", "TRMNL polling - returning latest image", { userId })

        return Response.json({
          has_image: true,
          image_url: getUserImageUrl(userId),
          prompt: latestImage?.prompt || "",
          synced_at: latestImage?.synced_at || new Date().toISOString(),
        })
      } catch (error) {
        log("ERROR", "TRMNL webhook error", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },

  // Get current sync status (authenticated)
  "/api/sync/status": {
    GET: withAuth(async (req, user) => {
      const filePath = getUserImagePath(user.id)
      const file = Bun.file(filePath)
      const hasImage = await file.exists()

      const latestImage = syncedImageQueries.findLatestByUserId.get(user.id)

      return Response.json({
        hasSyncedImage: hasImage,
        syncedAt: latestImage?.synced_at || null,
        imageUrl: hasImage ? getUserImageUrl(user.id) : null,
      })
    }),
  },

  // Get sync history (authenticated)
  "/api/sync/history": {
    GET: withAuth(async (req, user) => {
      const images = syncedImageQueries.findAllByUserId.all(user.id)
      return Response.json({
        images,
        count: images.length,
      })
    }),
  },

  // Clear sync history (authenticated)
  "/api/sync/clear": {
    DELETE: withAuth(async (req, user) => {
      // Delete the image file
      const filePath = getUserImagePath(user.id)
      const file = Bun.file(filePath)
      if (await file.exists()) {
        await Bun.write(filePath, "") // Clear the file
        const { unlinkSync } = await import("fs")
        try {
          unlinkSync(filePath)
        } catch {}
      }

      // Clear database records
      syncedImageQueries.deleteByUserId.run(user.id)
      log("INFO", "Cleared sync history and image", { userId: user.id })

      return Response.json({
        success: true,
        message: "Sync history cleared",
      })
    }),
  },
}
