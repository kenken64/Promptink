import { withAuth } from "../middleware/auth"
import { enhancePrompt } from "../services"
import { log } from "../utils"

interface EnhanceRequest {
  prompt: string
}

export const promptRoutes = {
  "/api/prompt/enhance": {
    POST: withAuth(async (req, user) => {
      try {
        const body = await req.json() as EnhanceRequest
        const { prompt } = body

        if (!prompt || typeof prompt !== "string") {
          return Response.json(
            { error: "Prompt is required" },
            { status: 400 }
          )
        }

        if (prompt.trim().length < 3) {
          return Response.json(
            { error: "Prompt is too short" },
            { status: 400 }
          )
        }

        log("INFO", "Enhancing prompt for user", { userId: user.id, promptLength: prompt.length })

        const enhanced = await enhancePrompt(prompt.trim())

        return Response.json({
          original: prompt.trim(),
          enhanced,
        })
      } catch (error) {
        log("ERROR", "Failed to enhance prompt", { error })
        return Response.json(
          { error: error instanceof Error ? error.message : "Failed to enhance prompt" },
          { status: 500 }
        )
      }
    }),
  },
}
