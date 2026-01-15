import { log } from "../utils"
import {
  generateImage,
  generateImageEdit,
  generateImageVariation,
  translateText,
  type GenerateImageOptions,
} from "../services/openai-service"
import { verifyToken } from "../services/auth-service"
import { generatedImageQueries } from "../db"
import { saveImageToGallery, getGalleryImageUrl } from "./gallery"

// Helper to extract user from request (optional auth)
async function getUserFromRequest(req: Request): Promise<{ id: number } | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return null
  }
  const token = authHeader.slice(7)
  try {
    const payload = verifyToken(token)
    if (!payload) return null
    return { id: payload.userId }
  } catch {
    return null
  }
}

export const imageRoutes = {
  // Generate image from prompt
  "/api/images/generate": {
    POST: async (req: Request) => {
      try {
        const user = await getUserFromRequest(req)
        const text = await req.text()
        const body = text ? JSON.parse(text) : {}

        if (!body.prompt) {
          return Response.json({ error: "prompt is required" }, { status: 400 })
        }

        const options: GenerateImageOptions = {
          prompt: body.prompt,
          model: body.model || "dall-e-3",
          n: body.n,
          size: body.size || "1024x1024",
          quality: body.quality,
          style: body.style,
          response_format: body.response_format,
        }

        const result = await generateImage(options)

        log("INFO", "Image generated", {
          userId: user?.id,
          language: body.language,
          hasRevisedPrompt: !!result.data?.[0]?.revised_prompt,
          revisedPromptPreview: result.data?.[0]?.revised_prompt?.substring(0, 50)
        })

        // If language is Chinese, translate the revised_prompt back to Chinese
        let originalRevisedPrompt = result.data?.[0]?.revised_prompt
        if (body.language === "zh" && result.data?.[0]?.revised_prompt) {
          log("INFO", "Translating revised_prompt to Chinese")
          try {
            const translatedPrompt = await translateText(result.data[0].revised_prompt, "zh")
            log("INFO", "Translation completed", { translatedPreview: translatedPrompt.substring(0, 50) })
            result.data[0].revised_prompt = translatedPrompt
          } catch (translateError) {
            log("WARN", "Failed to translate revised_prompt", translateError)
            // Keep original English prompt if translation fails
          }
        }

        // Auto-save to gallery if user is authenticated
        if (user && result.data?.[0]?.url) {
          try {
            // Create gallery record first to get the ID
            const galleryImage = generatedImageQueries.create.get(
              user.id,
              result.data[0].url, // Temporary URL, will be replaced
              body.prompt,
              originalRevisedPrompt || null,
              options.model || "dall-e-3",
              options.size || "1024x1024",
              options.style || null,
              0, // is_edit
              null // parent_image_id
            )

            if (galleryImage) {
              // Download and save the image
              await saveImageToGallery(result.data[0].url, user.id, galleryImage.id)
              
              // Update the URL to our permanent URL
              const permanentUrl = getGalleryImageUrl(galleryImage.id)
              
              // Add gallery info to response
              ;(result as any).galleryId = galleryImage.id
              ;(result as any).galleryUrl = permanentUrl

              log("INFO", "Image saved to gallery", { userId: user.id, galleryId: galleryImage.id })
            }
          } catch (galleryError) {
            log("WARN", "Failed to save image to gallery", galleryError)
            // Don't fail the request, just log the error
          }
        }

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
        const user = await getUserFromRequest(req)
        const formData = await req.formData()
        const image = formData.get("image") as File | null
        const prompt = formData.get("prompt") as string | null
        const mask = formData.get("mask") as File | null
        const n = formData.get("n") as string | null
        const size = formData.get("size") as string | null
        const response_format = formData.get("response_format") as string | null
        const parentImageId = formData.get("parentImageId") as string | null

        if (!image) {
          return Response.json({ error: "image file is required" }, { status: 400 })
        }
        if (!prompt) {
          return Response.json({ error: "prompt is required" }, { status: 400 })
        }

        const sizeValue = size || "1024x1024"
        const result = await generateImageEdit(
          await image.arrayBuffer(),
          prompt,
          {
            mask: mask ? await mask.arrayBuffer() : undefined,
            n: n ? parseInt(n) : undefined,
            size: sizeValue as any,
            response_format: response_format as any,
          }
        )

        // Auto-save to gallery if user is authenticated
        if (user && result.data?.[0]?.url) {
          try {
            const galleryImage = generatedImageQueries.create.get(
              user.id,
              result.data[0].url,
              prompt,
              null, // Edit API doesn't return revised_prompt
              "dall-e-2", // Edit uses DALL-E 2
              sizeValue,
              null,
              1, // is_edit = true
              parentImageId ? parseInt(parentImageId, 10) : null
            )

            if (galleryImage) {
              await saveImageToGallery(result.data[0].url, user.id, galleryImage.id)
              const permanentUrl = getGalleryImageUrl(galleryImage.id)
              ;(result as any).galleryId = galleryImage.id
              ;(result as any).galleryUrl = permanentUrl
              log("INFO", "Edited image saved to gallery", { userId: user.id, galleryId: galleryImage.id })
            }
          } catch (galleryError) {
            log("WARN", "Failed to save edited image to gallery", galleryError)
          }
        }

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
