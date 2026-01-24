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
        trmnl_background_color: settings?.trmnl_background_color || "black",
        timezone: settings?.timezone || "UTC",
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
        const newBackgroundColor = body.trmnl_background_color !== undefined
          ? body.trmnl_background_color
          : currentSettings?.trmnl_background_color || "black"

        // Update TRMNL settings
        userQueries.updateSettings.run(newApiKey, newMacAddress, newBackgroundColor, user.id)

        // Update timezone if provided
        if (body.timezone !== undefined) {
          userQueries.updateTimezone.run(body.timezone, user.id)
        }

        const newTimezone = body.timezone !== undefined
          ? body.timezone
          : currentSettings?.timezone || "UTC"

        log("INFO", "User settings updated", { userId: user.id, backgroundColor: newBackgroundColor, timezone: newTimezone })

        return Response.json({
          success: true,
          settings: {
            trmnl_device_api_key: newApiKey,
            trmnl_mac_address: newMacAddress,
            trmnl_background_color: newBackgroundColor,
            timezone: newTimezone,
          },
        })
      } catch (error) {
        log("ERROR", "Failed to update settings", error)
        return Response.json({ error: "Failed to update settings" }, { status: 500 })
      }
    }),
  },
}
