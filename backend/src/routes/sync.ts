import { log } from "../utils"
import { withAuth } from "../middleware/auth"
import { syncedImageQueries, userQueries } from "../db"
import { config } from "../config"

// Download image and convert to base64 data URL
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  log("INFO", "Downloading image to convert to base64", { imageUrl: imageUrl.substring(0, 100) + "..." })

  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download image: HTTP ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")
  const contentType = response.headers.get("content-type") || "image/png"

  log("INFO", "Image converted to base64", {
    originalSize: arrayBuffer.byteLength,
    base64Length: base64.length,
    contentType
  })

  return `data:${contentType};base64,${base64}`
}

// Trigger TRMNL plugin data update with base64 image (image already converted)
async function triggerTrmnlUpdate(base64ImageUrl: string, prompt: string): Promise<{ success: boolean; error?: string }> {
  const pluginUuid = config.trmnl.customPluginUuid

  if (!pluginUuid) {
    log("WARN", "TRMNL_CUSTOM_PLUGIN_UUID not configured, skipping TRMNL update")
    return { success: false, error: "Plugin UUID not configured" }
  }

  try {
    // Use the custom_plugins webhook endpoint (no auth required for webhook)
    const url = `https://usetrmnl.com/api/custom_plugins/${pluginUuid}`
    log("INFO", "Sending base64 image data to TRMNL custom plugin", { url, base64Length: base64ImageUrl.length })

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merge_variables: {
          has_image: true,
          image_url: base64ImageUrl,
          prompt: prompt,
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

export const syncRoutes = {
  // Sync image - converts to base64 and stores for TRMNL (authenticated)
  "/api/sync/trmnl": {
    POST: withAuth(async (req, user) => {
      try {
        const text = await req.text()
        const { imageUrl, prompt } = text ? JSON.parse(text) : {}

        if (!imageUrl) {
          return Response.json({ error: "imageUrl is required" }, { status: 400 })
        }

        log("INFO", "Syncing image for TRMNL", { userId: user.id, imageUrl: imageUrl.substring(0, 100) + "...", prompt })

        // Convert DALL-E URL to base64 to prevent expiration
        let base64ImageUrl: string
        try {
          base64ImageUrl = await imageUrlToBase64(imageUrl)
        } catch (downloadError) {
          log("ERROR", "Failed to download and convert image to base64", downloadError)
          return Response.json({ error: `Failed to download image: ${String(downloadError)}` }, { status: 500 })
        }

        // Store base64 image in database for this user
        const syncedImage = syncedImageQueries.create.get(user.id, base64ImageUrl, prompt || null)

        if (!syncedImage) {
          return Response.json({ error: "Failed to store image" }, { status: 500 })
        }

        log("INFO", "Base64 image stored in database", { userId: user.id, imageId: syncedImage.id, base64Length: base64ImageUrl.length })

        // Generate the user's webhook URL
        const webhookUrl = `/api/trmnl/webhook/${user.id}`

        // Trigger TRMNL plugin update with base64 image
        const updateResult = await triggerTrmnlUpdate(base64ImageUrl, prompt || "")

        return Response.json({
          success: true,
          message: updateResult.success
            ? "Image synced and sent to TRMNL!"
            : "Image synced successfully. TRMNL will pick it up on next poll.",
          syncedAt: syncedImage.synced_at,
          webhookUrl,
          trmnlUpdate: updateResult,
        })
      } catch (error) {
        log("ERROR", "Failed to sync image", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // TRMNL webhook endpoint - returns the latest synced image for a specific user (public)
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

        // Get latest synced image for this user
        const latestImage = syncedImageQueries.findLatestByUserId.get(userId)

        if (!latestImage) {
          return Response.json({
            has_image: false,
            message: "No image synced yet",
          })
        }

        log("INFO", "TRMNL polling - returning latest image", { userId, imageId: latestImage.id })

        return Response.json({
          has_image: true,
          image_url: latestImage.image_url,
          prompt: latestImage.prompt || "",
          synced_at: latestImage.synced_at,
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
      const latestImage = syncedImageQueries.findLatestByUserId.get(user.id)
      const webhookUrl = `/api/trmnl/webhook/${user.id}`

      return Response.json({
        hasSyncedImage: !!latestImage,
        syncedAt: latestImage?.synced_at || null,
        webhookUrl,
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
      syncedImageQueries.deleteByUserId.run(user.id)
      log("INFO", "Cleared sync history", { userId: user.id })
      return Response.json({
        success: true,
        message: "Sync history cleared",
      })
    }),
  },
}
