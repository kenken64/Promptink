import { log } from "../utils"
import {
  generateImage,
  generateImageEdit,
  generateImageVariation,
  translateText,
  generateInfographicPrompt,
  fetchUrlContent,
  isGitHubRepoUrl,
  type GenerateImageOptions,
} from "../services/openai-service"
import { summarizeGitHubRepo } from "../services/repomix-service"
import { verifyToken } from "../services/auth-service"
import { generatedImageQueries } from "../db"
import { saveImageToGallery, getGalleryImageUrl } from "./gallery"

// Style preset definitions with prompt modifiers
const stylePresets: Record<string, string> = {
  "none": "",
  "photorealistic": ", photorealistic, high-resolution photography, detailed, sharp focus, professional photography",
  "anime": ", anime style, Japanese animation, vibrant colors, cel-shaded, manga-inspired",
  "watercolor": ", watercolor painting style, soft brushstrokes, flowing colors, artistic, traditional watercolor on paper",
  "oil-painting": ", oil painting style, textured brushstrokes, rich colors, classical art technique, canvas texture",
  "pixel-art": ", pixel art style, 8-bit, retro video game aesthetic, blocky pixels, nostalgic",
  "3d-render": ", 3D render, CGI, Blender style, realistic lighting, raytraced, octane render",
  "sketch": ", pencil sketch style, hand-drawn, graphite, charcoal drawing, artistic sketch on paper",
  "pop-art": ", pop art style, bold colors, comic book style, Roy Lichtenstein inspired, halftone dots",
  "minimalist": ", minimalist style, clean lines, simple shapes, flat design, negative space, modern",
  "cinematic": ", cinematic style, dramatic lighting, movie poster aesthetic, film grain, wide aspect, epic",
}

// Apply style preset to prompt
function applyStylePreset(prompt: string, stylePreset: string): string {
  const modifier = stylePresets[stylePreset] || ""
  if (!modifier) return prompt
  return prompt + modifier
}

// Helper to extract user from request (optional auth)
async function getUserFromRequest(req: Request): Promise<{ id: number } | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return null
  }
  const token = authHeader.slice(7)
  try {
    const payload = await verifyToken(token, "access")
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

        // Apply style preset to prompt if specified
        const originalPrompt = body.prompt
        const styledPrompt = body.stylePreset 
          ? applyStylePreset(body.prompt, body.stylePreset)
          : body.prompt

        log("INFO", "Generating image", {
          userId: user?.id,
          stylePreset: body.stylePreset || "none",
          originalPromptPreview: originalPrompt.substring(0, 50),
          styledPromptPreview: styledPrompt.substring(0, 80),
        })

        const options: GenerateImageOptions = {
          prompt: styledPrompt,
          model: body.model || "dall-e-3",
          n: body.n,
          size: body.size || "1024x1024",
          quality: body.quality,
          style: body.style || "vivid",
          response_format: body.response_format,
        }

        // Store values for database with guaranteed non-null/non-undefined defaults
        const dbModel = String(options.model || "dall-e-3")
        const dbSize = String(options.size || "1024x1024")
        const dbStyle = options.style ? String(options.style) : null

        const result = await generateImage(options)

        log("INFO", "Image generated", {
          userId: user?.id,
          language: body.language,
          stylePreset: body.stylePreset || "none",
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
            // Ensure userId is a valid number
            const userId = typeof user.id === 'number' ? user.id : null
            if (!userId) {
              log("WARN", "Cannot save to gallery: invalid user ID", { userId: user.id, userIdType: typeof user.id })
              throw new Error("Invalid user ID")
            }

            // Prepare values with guaranteed non-null for required fields
            const galleryData = {
              userId: userId,
              imageUrl: String(result.data[0].url),
              originalPrompt: String(body.prompt || originalPrompt || "No prompt"),
              revisedPrompt: originalRevisedPrompt ? String(originalRevisedPrompt) : null,
              model: dbModel,
              size: dbSize,
              style: dbStyle,
              isEdit: 0,
              parentImageId: null
            }
            
            log("DEBUG", "Saving to gallery", {
              userId: galleryData.userId,
              userIdType: typeof galleryData.userId,
              hasImageUrl: !!galleryData.imageUrl,
              originalPrompt: galleryData.originalPrompt?.substring(0, 50),
              hasRevisedPrompt: !!galleryData.revisedPrompt,
              model: galleryData.model,
              size: galleryData.size,
              style: galleryData.style
            })

            // Create gallery record first to get the ID
            const galleryImage = generatedImageQueries.create.get(
              galleryData.userId,
              galleryData.imageUrl,
              galleryData.originalPrompt,
              galleryData.revisedPrompt,
              galleryData.model,
              galleryData.size,
              galleryData.style,
              galleryData.isEdit,
              galleryData.parentImageId
            )

            if (galleryImage) {
              // Download and save the image
              await saveImageToGallery(result.data[0].url, user.id, galleryImage.id)
              
              // Update the URL to our permanent URL
              const permanentUrl = getGalleryImageUrl(galleryImage.id)
              generatedImageQueries.updateImageUrl.run(permanentUrl, galleryImage.id)
              
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

        log("INFO", "Image edit request", { 
          imageSize: image.size, 
          imageName: image.name,
          hasMask: !!mask, 
          maskSize: mask?.size,
          prompt,
          size 
        })

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
              generatedImageQueries.updateImageUrl.run(permanentUrl, galleryImage.id)
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

  // Generate infographic from text or URL
  "/api/images/infographic": {
    POST: async (req: Request) => {
      try {
        const user = await getUserFromRequest(req)
        const text = await req.text()
        const body = text ? JSON.parse(text) : {}

        // Either content (text/markdown) or url is required
        if (!body.content && !body.url) {
          return Response.json(
            { error: "Either 'content' (text/markdown) or 'url' (GitHub URL) is required" },
            { status: 400 }
          )
        }

        let content = body.content

        // If URL provided, fetch the content
        if (body.url) {
          if (isGitHubRepoUrl(body.url)) {
            // Use Repomix for full repository URLs
            log("INFO", "Summarizing GitHub repo with Repomix for infographic", { url: body.url, userId: user?.id })
            content = await summarizeGitHubRepo(body.url)
          } else {
            // Use existing fetch for individual file URLs
            log("INFO", "Fetching content from URL for infographic", { url: body.url, userId: user?.id })
            content = await fetchUrlContent(body.url)
          }
        }

        // Generate infographic prompt using GPT-4
        log("INFO", "Generating infographic", { userId: user?.id, contentLength: content.length })
        const infographicPrompt = await generateInfographicPrompt(content)

        // Add infographic styling to the prompt
        const styledPrompt = `${infographicPrompt}, professional infographic design, clean modern layout, presentation style, high quality, 4K resolution, suitable for business presentation or social media`

        // Generate the image with DALL-E
        const options: GenerateImageOptions = {
          prompt: styledPrompt,
          model: "dall-e-3",
          size: body.size || "1792x1024", // Wide format for presentations
          quality: "hd",
          style: "vivid",
        }

        const result = await generateImage(options)

        // Save to gallery if user is authenticated
        if (user && result.data?.[0]?.url) {
          try {
            const originalPrompt = `[Infographic] ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`
            const galleryImage = generatedImageQueries.create.get(
              user.id,
              result.data[0].url, // Temporary URL, will be replaced
              originalPrompt,
              result.data[0].revised_prompt || styledPrompt,
              options.model || "dall-e-3",
              options.size || "1792x1024",
              options.style || null,
              0, // is_edit
              null // parent_image_id
            )

            if (galleryImage) {
              await saveImageToGallery(result.data[0].url, user.id, galleryImage.id)
              const permanentUrl = getGalleryImageUrl(galleryImage.id)
              generatedImageQueries.updateImageUrl.run(permanentUrl, galleryImage.id)
              ;(result as any).galleryId = galleryImage.id
              ;(result as any).galleryUrl = permanentUrl
              log("INFO", "Infographic saved to gallery", { userId: user.id, galleryId: galleryImage.id })
            }
          } catch (galleryError) {
            log("WARN", "Failed to save infographic to gallery", galleryError)
          }
        }

        return Response.json({
          ...result,
          infographicPrompt, // Include the generated prompt for transparency
        })
      } catch (error) {
        log("ERROR", "Failed to generate infographic", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },
}
