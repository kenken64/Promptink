import { log } from "../utils"
import {
  generateImage,
  generateImageEdit,
  generateImageVariation,
  type GenerateImageOptions,
} from "../services/openai-service"

export const imageRoutes = {
  // Generate image from prompt
  "/api/images/generate": {
    POST: async (req: Request) => {
      try {
        const text = await req.text()
        const body = text ? JSON.parse(text) : {}

        if (!body.prompt) {
          return Response.json({ error: "prompt is required" }, { status: 400 })
        }

        const options: GenerateImageOptions = {
          prompt: body.prompt,
          model: body.model,
          n: body.n,
          size: body.size,
          quality: body.quality,
          style: body.style,
          response_format: body.response_format,
        }

        const result = await generateImage(options)
        return Response.json(result)
      } catch (error) {
        log("ERROR", "Failed to generate image", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },

  // Edit an existing image
  "/api/images/edit": {
    POST: async (req: Request) => {
      try {
        const formData = await req.formData()
        const image = formData.get("image") as File | null
        const prompt = formData.get("prompt") as string | null
        const mask = formData.get("mask") as File | null
        const n = formData.get("n") as string | null
        const size = formData.get("size") as string | null
        const response_format = formData.get("response_format") as string | null

        if (!image) {
          return Response.json({ error: "image file is required" }, { status: 400 })
        }
        if (!prompt) {
          return Response.json({ error: "prompt is required" }, { status: 400 })
        }

        const result = await generateImageEdit(
          await image.arrayBuffer(),
          prompt,
          {
            mask: mask ? await mask.arrayBuffer() : undefined,
            n: n ? parseInt(n) : undefined,
            size: size as any,
            response_format: response_format as any,
          }
        )

        return Response.json(result)
      } catch (error) {
        log("ERROR", "Failed to edit image", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },

  // Create variation of an image
  "/api/images/variation": {
    POST: async (req: Request) => {
      try {
        const formData = await req.formData()
        const image = formData.get("image") as File | null
        const n = formData.get("n") as string | null
        const size = formData.get("size") as string | null
        const response_format = formData.get("response_format") as string | null

        if (!image) {
          return Response.json({ error: "image file is required" }, { status: 400 })
        }

        const result = await generateImageVariation(
          await image.arrayBuffer(),
          {
            n: n ? parseInt(n) : undefined,
            size: size as any,
            response_format: response_format as any,
          }
        )

        return Response.json(result)
      } catch (error) {
        log("ERROR", "Failed to create image variation", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },
}
