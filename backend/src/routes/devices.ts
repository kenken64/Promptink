import { userDeviceQueries, type UserDevice } from "../db"
import { withAuth } from "../middleware/auth"
import { log } from "../utils"

// Device response type (includes webhook URL)
interface DeviceResponse {
  id: number
  name: string
  webhook_url: string
  background_color: "black" | "white"
  is_default: boolean
  mac_address: string | null
  device_api_key: string | null
  created_at: string
  updated_at: string
}

// Convert database device to response format
function toDeviceResponse(device: UserDevice): DeviceResponse {
  return {
    id: device.id,
    name: device.name,
    webhook_url: device.webhook_uuid, // webhook_uuid now stores the full URL
    background_color: device.background_color,
    is_default: device.is_default === 1,
    mac_address: device.mac_address,
    device_api_key: device.device_api_key,
    created_at: device.created_at,
    updated_at: device.updated_at,
  }
}

export const devicesRoutes = {
  // Get all devices for current user
  "/api/devices": {
    GET: withAuth(async (_req, user) => {
      try {
        const devices = userDeviceQueries.findAllByUserId.all(user.id)
        return Response.json({
          devices: devices.map(toDeviceResponse),
        })
      } catch (error) {
        log("ERROR", "Failed to fetch devices", error)
        return Response.json({ error: "Failed to fetch devices" }, { status: 500 })
      }
    }),

    // Create a new device
    POST: withAuth(async (req, user) => {
      try {
        const body = await req.json() as {
          name: string
          webhook_url?: string
          background_color?: "black" | "white"
          is_default?: boolean
        }

        if (!body.name || body.name.trim().length === 0) {
          return Response.json({ error: "Device name is required" }, { status: 400 })
        }

        if (!body.webhook_url || body.webhook_url.trim().length === 0) {
          return Response.json({ error: "Webhook URL is required" }, { status: 400 })
        }

        const name = body.name.trim()
        const webhookUrl = body.webhook_url.trim()
        const backgroundColor = body.background_color || "black"
        
        // Use the provided webhook URL as the identifier (store full URL)
        const webhookUuid = webhookUrl

        // Check if this is the first device - make it default
        const existingCount = userDeviceQueries.countByUserId.get(user.id)
        const isDefault = existingCount?.count === 0 || body.is_default === true

        // If setting as default, clear existing defaults first
        if (isDefault) {
          userDeviceQueries.clearDefault.run(user.id)
        }

        const device = userDeviceQueries.create.get(
          user.id,
          name,
          webhookUuid,
          backgroundColor,
          isDefault ? 1 : 0,
          null, // mac_address - set by admin
          null  // device_api_key - set by admin
        )

        if (!device) {
          return Response.json({ error: "Failed to create device" }, { status: 500 })
        }

        log("INFO", "Device created", { userId: user.id, deviceId: device.id, name })

        return Response.json({
          success: true,
          device: toDeviceResponse(device),
        })
      } catch (error) {
        log("ERROR", "Failed to create device", error)
        return Response.json({ error: "Failed to create device" }, { status: 500 })
      }
    }),
  },

  // Get, update, or delete a specific device
  "/api/devices/:id": {
    GET: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        const deviceId = parseInt(url.pathname.split("/").pop() || "0", 10)

        if (isNaN(deviceId)) {
          return Response.json({ error: "Invalid device ID" }, { status: 400 })
        }

        const device = userDeviceQueries.findByIdAndUserId.get(deviceId, user.id)

        if (!device) {
          return Response.json({ error: "Device not found" }, { status: 404 })
        }

        return Response.json({
          device: toDeviceResponse(device),
        })
      } catch (error) {
        log("ERROR", "Failed to fetch device", error)
        return Response.json({ error: "Failed to fetch device" }, { status: 500 })
      }
    }),

    PUT: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        const deviceId = parseInt(url.pathname.split("/").pop() || "0", 10)

        if (isNaN(deviceId)) {
          return Response.json({ error: "Invalid device ID" }, { status: 400 })
        }

        const device = userDeviceQueries.findByIdAndUserId.get(deviceId, user.id)

        if (!device) {
          return Response.json({ error: "Device not found" }, { status: 404 })
        }

        const body = await req.json() as {
          name?: string
          webhook_url?: string
          background_color?: "black" | "white"
          is_default?: boolean
        }

        const newName = body.name?.trim() || device.name
        const newWebhookUrl = body.webhook_url?.trim() || device.webhook_uuid
        const newBackgroundColor = body.background_color || device.background_color

        // Update device (preserve mac_address and device_api_key - only admin can change those)
        userDeviceQueries.update.run(newName, newWebhookUrl, newBackgroundColor, device.mac_address, device.device_api_key, deviceId)

        // Handle default flag
        if (body.is_default === true) {
          userDeviceQueries.clearDefault.run(user.id)
          userDeviceQueries.setDefault.run(deviceId, user.id)
        }

        // Fetch updated device
        const updatedDevice = userDeviceQueries.findByIdAndUserId.get(deviceId, user.id)

        log("INFO", "Device updated", { userId: user.id, deviceId, name: newName })

        return Response.json({
          success: true,
          device: updatedDevice ? toDeviceResponse(updatedDevice) : null,
        })
      } catch (error) {
        log("ERROR", "Failed to update device", error)
        return Response.json({ error: "Failed to update device" }, { status: 500 })
      }
    }),

    DELETE: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        const deviceId = parseInt(url.pathname.split("/").pop() || "0", 10)

        if (isNaN(deviceId)) {
          return Response.json({ error: "Invalid device ID" }, { status: 400 })
        }

        const device = userDeviceQueries.findByIdAndUserId.get(deviceId, user.id)

        if (!device) {
          return Response.json({ error: "Device not found" }, { status: 404 })
        }

        const wasDefault = device.is_default === 1

        // Delete device
        userDeviceQueries.delete.run(deviceId, user.id)

        // If deleted device was default, set another device as default
        if (wasDefault) {
          const remainingDevices = userDeviceQueries.findAllByUserId.all(user.id)
          if (remainingDevices.length > 0 && remainingDevices[0]) {
            userDeviceQueries.setDefault.run(remainingDevices[0].id, user.id)
          }
        }

        log("INFO", "Device deleted", { userId: user.id, deviceId })

        return Response.json({
          success: true,
          message: "Device deleted successfully",
        })
      } catch (error) {
        log("ERROR", "Failed to delete device", error)
        return Response.json({ error: "Failed to delete device" }, { status: 500 })
      }
    }),
  },

  // Set a device as default
  "/api/devices/:id/default": {
    POST: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        // URL pattern: /api/devices/:id/default - get the second to last segment
        const pathParts = url.pathname.split("/")
        const deviceId = parseInt(pathParts[pathParts.length - 2] || "0", 10)

        if (isNaN(deviceId)) {
          return Response.json({ error: "Invalid device ID" }, { status: 400 })
        }

        const device = userDeviceQueries.findByIdAndUserId.get(deviceId, user.id)

        if (!device) {
          return Response.json({ error: "Device not found" }, { status: 404 })
        }

        // Clear existing defaults and set new one
        userDeviceQueries.clearDefault.run(user.id)
        userDeviceQueries.setDefault.run(deviceId, user.id)

        const updatedDevice = userDeviceQueries.findByIdAndUserId.get(deviceId, user.id)

        log("INFO", "Device set as default", { userId: user.id, deviceId })

        return Response.json({
          success: true,
          device: updatedDevice ? toDeviceResponse(updatedDevice) : null,
        })
      } catch (error) {
        log("ERROR", "Failed to set default device", error)
        return Response.json({ error: "Failed to set default device" }, { status: 500 })
      }
    }),
  },
}
