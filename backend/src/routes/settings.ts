import { userQueries, type UserSettings } from "../db"
import { withAuth } from "../middleware/auth"
import { log } from "../utils"

export const settingsRoutes = {
  "/api/settings": {
    // Get current user settings
    GET: withAuth(async (_req, user) => {
      const settings = userQueries.getSettings.get(user.id)

      return Response.json({
        trmnl_device_api_key: settings?.trmnl_device_api_key || null,
        trmnl_mac_address: settings?.trmnl_mac_address || null,
      })
    }),

    // Update user settings
    PUT: withAuth(async (req, user) => {
      try {
        const body = await req.json() as Partial<UserSettings>

        // Get current settings first
        const currentSettings = userQueries.getSettings.get(user.id)

        // Merge with new values
        const newApiKey = body.trmnl_device_api_key !== undefined
          ? body.trmnl_device_api_key
          : currentSettings?.trmnl_device_api_key || null
        const newMacAddress = body.trmnl_mac_address !== undefined
          ? body.trmnl_mac_address
          : currentSettings?.trmnl_mac_address || null

        // Update settings
        userQueries.updateSettings.run(newApiKey, newMacAddress, user.id)

        log("INFO", "User settings updated", { userId: user.id })

        return Response.json({
          success: true,
          settings: {
            trmnl_device_api_key: newApiKey,
            trmnl_mac_address: newMacAddress,
          },
        })
      } catch (error) {
        log("ERROR", "Failed to update settings", error)
        return Response.json({ error: "Failed to update settings" }, { status: 500 })
      }
    }),
  },
}
