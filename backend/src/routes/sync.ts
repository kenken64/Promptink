import { log } from "../utils"
import { withAuth } from "../middleware/auth"
import { syncedImageQueries, userQueries } from "../db"
import { config } from "../config"
import { getCurrentScreen } from "../services"
import { mkdirSync, existsSync } from "fs"
import { join } from "path"

// Get user's background color preference
function getUserBackgroundColor(userId: number): string {
  const settings = userQueries.getSettings.get(userId)
  return settings?.trmnl_background_color || "black"
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

// Advance TRMNL playlist by calling display endpoint (triggers device to get new content on next wake)
async function advanceTrmnlPlaylist(): Promise<{ success: boolean; error?: string }> {
  try {
    log("INFO", "Advancing TRMNL playlist to trigger screen update")
    const screen = await getCurrentScreen()
    log("INFO", "TRMNL playlist advanced", { imageUrl: screen.image_url, refreshRate: screen.refresh_rate })
    return { success: true }
  } catch (error) {
    log("WARN", "Failed to advance TRMNL playlist", error)
    return { success: false, error: String(error) }
  }
}

// Trigger TRMNL plugin data update with permanent image URL
async function triggerTrmnlUpdate(imageUrl: string, prompt: string, backgroundColor: string): Promise<{ success: boolean; error?: string }> {
  const pluginUuid = config.trmnl.customPluginUuid

  if (!pluginUuid) {
    log("WARN", "TRMNL_CUSTOM_PLUGIN_UUID not configured, skipping TRMNL update")
    return { success: false, error: "Plugin UUID not configured" }
  }

  try {
    const url = `https://usetrmnl.com/api/custom_plugins/${pluginUuid}`
    const bgHex = backgroundColor === "white" ? "#fff" : "#000"
    log("INFO", "Sending image URL to TRMNL custom plugin", { url, imageUrl, backgroundColor: bgHex })

    const response = await fetch(url, {
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
      log("INFO", "TRMNL plugin data updated successfully")
      return { success: true }
    } else {
      const errorText = await response.text()
      log("WARN", "TRMNL plugin update failed", { status: response.status, error: errorText })
      return { success: false, error: `HTTP ${response.status}: ${errorText}` }
    }
  } catch (error) {
    log("ERROR", "TRMNL plugin update error", error)
    return { success: false, error: String(error) }
  }
}

// Exported helper for programmatic sync (used by scheduler)
export async function syncToTrmnl(
  imageUrl: string,
  prompt: string,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Download and save the image
    await downloadAndSaveImage(imageUrl, userId)

    // Get the permanent URL
    const permanentUrl = getUserImageUrl(userId)

    // Save to database
    syncedImageQueries.create.run(userId, permanentUrl, prompt || null)

    // Get user's background color preference
    const backgroundColor = getUserBackgroundColor(userId)

    // Trigger TRMNL update
    const trmnlResult = await triggerTrmnlUpdate(permanentUrl, prompt || "", backgroundColor)

    // Advance the playlist
    await advanceTrmnlPlaylist()

    return { success: true }
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
        const { imageUrl, prompt } = text ? JSON.parse(text) : {}

        if (!imageUrl) {
          return Response.json({ error: "imageUrl is required" }, { status: 400 })
        }

        log("INFO", "Syncing image for TRMNL", { userId: user.id, imageUrl: imageUrl.substring(0, 100) + "...", prompt })

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

        // Get user's background color preference
        const backgroundColor = getUserBackgroundColor(user.id)

        log("INFO", "Image synced successfully", { userId: user.id, filePath, permanentImageUrl, backgroundColor })

        // Run TRMNL API calls in parallel for faster response
        const trmnlStart = performance.now()
        const [updateResult, advanceResult] = await Promise.all([
          // Trigger TRMNL plugin update with permanent URL and background color
          triggerTrmnlUpdate(permanentImageUrl, prompt || "", backgroundColor),
          // Advance TRMNL playlist to trigger device refresh on next wake
          advanceTrmnlPlaylist(),
        ])
        const trmnlTime = performance.now() - trmnlStart
        log("INFO", `TRMNL API calls completed`, { trmnlTimeMs: Math.round(trmnlTime) })

        const totalTime = performance.now() - startTime
        log("INFO", `Sync completed`, {
          totalTimeMs: Math.round(totalTime),
          downloadTimeMs: Math.round(downloadTime),
          dbTimeMs: Math.round(dbTime),
          trmnlTimeMs: Math.round(trmnlTime)
        })

        return Response.json({
          success: true,
          message: updateResult.success
            ? "Image synced and sent to TRMNL!"
            : "Image synced successfully. TRMNL will pick it up on next poll.",
          syncedAt: syncedImage.synced_at,
          imageUrl: permanentImageUrl,
          trmnlUpdate: updateResult,
          playlistAdvanced: advanceResult.success,
          timing: {
            totalMs: Math.round(totalTime),
            downloadMs: Math.round(downloadTime),
            trmnlMs: Math.round(trmnlTime),
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
