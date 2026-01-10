import { log } from "../utils"
import {
  getCurrentScreen,
  getCurrentScreenPreview,
  updatePluginData,
  renderMarkup,
} from "../services"

export const displayRoutes = {
  "/api/display": {
    GET: async () => {
      try {
        const screen = await getCurrentScreen()
        return Response.json(screen)
      } catch (error) {
        log("ERROR", "Failed to get display", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },

  "/api/display/current": {
    GET: async () => {
      try {
        const screen = await getCurrentScreenPreview()
        return Response.json(screen)
      } catch (error) {
        log("ERROR", "Failed to get current display", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },

  "/api/display/message": {
    POST: async (req: Request) => {
      try {
        const text = await req.text()
        log("DEBUG", "Message request body", text)

        const { pluginId, title, message } = text ? JSON.parse(text) : {}

        if (!pluginId) {
          return Response.json(
            { error: "pluginId is required" },
            { status: 400 }
          )
        }

        log("INFO", `Sending message to plugin ${pluginId}`, { title, message })
        const response = await updatePluginData(pluginId, {
          title: title || "Message",
          message: message || "",
        })

        const result = await response.json()
        return Response.json({
          success: response.ok,
          result,
        })
      } catch (error) {
        log("ERROR", "Failed to send message", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },

  "/api/render": {
    POST: async (req: Request) => {
      try {
        const text = await req.text()
        const { markup, variables } = text ? JSON.parse(text) : {}
        const rendered = await renderMarkup(markup, variables)
        return Response.json({ rendered })
      } catch (error) {
        log("ERROR", "Failed to render markup", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },
}
