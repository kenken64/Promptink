import { config } from "../config"
import { log } from "../utils"
import {
  getPluginSettings,
  updatePluginData,
  uploadPluginImage,
  sendToCustomPlugin,
} from "../services"

export const pluginRoutes = {
  "/api/plugins": {
    GET: async () => {
      try {
        const plugins = await getPluginSettings()
        return Response.json(plugins)
      } catch (error) {
        log("ERROR", "Failed to get plugins", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },

  "/api/plugins/:id/data": {
    POST: async (req: Request & { params: { id: string } }) => {
      try {
        const pluginId = parseInt(req.params.id)
        log("INFO", `POST /api/plugins/${pluginId}/data`)

        const text = await req.text()
        log("DEBUG", "Request body", text)

        const body = text ? JSON.parse(text) : {}
        log("DEBUG", "Parsed body", body)

        const response = await updatePluginData(pluginId, body)
        const responseText = await response.text()
        log("DEBUG", "TRMNL response", responseText)

        const result = responseText ? JSON.parse(responseText) : { status: response.status }
        log("INFO", "Plugin update result", result)
        return Response.json(result, { status: response.status })
      } catch (error) {
        log("ERROR", "Failed to update plugin", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },

  "/api/plugins/:id/image": {
    POST: async (req: Request & { params: { id: string } }) => {
      try {
        const pluginId = parseInt(req.params.id)
        log("INFO", `POST /api/plugins/${pluginId}/image`)

        const formData = await req.formData()
        const image = formData.get("image") as File | null

        if (!image) {
          return Response.json({ error: "image file is required" }, { status: 400 })
        }

        const response = await uploadPluginImage(
          pluginId,
          await image.arrayBuffer(),
          image.name || "image.png"
        )

        const responseText = await response.text()
        log("DEBUG", "TRMNL image upload response", responseText)

        const result = responseText ? JSON.parse(responseText) : { status: response.status }
        return Response.json(result, { status: response.status })
      } catch (error) {
        log("ERROR", "Failed to upload image", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },

  "/api/custom-plugin": {
    POST: async (req: Request) => {
      try {
        if (!config.trmnl.customPluginUuid) {
          return Response.json(
            { error: "TRMNL_CUSTOM_PLUGIN_UUID not configured" },
            { status: 400 }
          )
        }

        const text = await req.text()
        log("DEBUG", "Custom plugin request body", text)

        const body = text ? JSON.parse(text) : {}
        const response = await sendToCustomPlugin(config.trmnl.customPluginUuid, body)
        const result = await response.json()

        log("INFO", "Custom plugin response", result)
        return Response.json(result)
      } catch (error) {
        log("ERROR", "Failed to send to custom plugin", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },
}
