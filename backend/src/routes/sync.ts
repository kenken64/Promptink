import { log } from "../utils"
import { withAuth } from "../middleware/auth"
import { syncedImageQueries, userQueries } from "../db"

export const syncRoutes = {
  // Sync image - stores the image URL for TRMNL to poll (authenticated)
  "/api/sync/trmnl": {
    POST: withAuth(async (req, user) => {
      try {
        const text = await req.text()
        const { imageUrl, prompt } = text ? JSON.parse(text) : {}

        if (!imageUrl) {
          return Response.json({ error: "imageUrl is required" }, { status: 400 })
        }

        log("INFO", "Storing image for TRMNL sync", { userId: user.id, imageUrl, prompt })

        // Store in database for this user
        const syncedImage = syncedImageQueries.create.get(user.id, imageUrl, prompt || null)

        if (!syncedImage) {
          return Response.json({ error: "Failed to store image" }, { status: 500 })
        }

        // Generate the user's webhook URL
        const webhookUrl = `/api/trmnl/webhook/${user.id}`

        return Response.json({
          success: true,
          message: "Image synced successfully. TRMNL will pick it up on next poll.",
          syncedAt: syncedImage.synced_at,
          webhookUrl,
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
