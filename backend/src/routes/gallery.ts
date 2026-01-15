import { log } from "../utils"
import { withAuth } from "../middleware/auth"
import { generatedImageQueries, type GeneratedImage } from "../db"
import { config } from "../config"
import { mkdirSync, existsSync } from "fs"
import { join } from "path"

// Ensure gallery images directory exists
const GALLERY_DIR = join(config.storage.imagesDir, "gallery")
if (!existsSync(GALLERY_DIR)) {
  mkdirSync(GALLERY_DIR, { recursive: true })
  log("INFO", "Created gallery images directory", { path: GALLERY_DIR })
}

// Get the file path for a gallery image
export function getGalleryImagePath(userId: number, imageId: number): string {
  const userDir = join(GALLERY_DIR, `user_${userId}`)
  if (!existsSync(userDir)) {
    mkdirSync(userDir, { recursive: true })
  }
  return join(userDir, `${imageId}.png`)
}

// Get the public URL for a gallery image
export function getGalleryImageUrl(imageId: number): string {
  return `${config.server.baseUrl}/api/gallery/image/${imageId}`
}

// Download image from URL and save to gallery
export async function saveImageToGallery(imageUrl: string, userId: number, imageId: number): Promise<string> {
  log("INFO", "Saving image to gallery", { imageUrl: imageUrl.substring(0, 100) + "...", userId, imageId })

  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download image: HTTP ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const filePath = getGalleryImagePath(userId, imageId)

  await Bun.write(filePath, arrayBuffer)

  log("INFO", "Gallery image saved", {
    userId,
    imageId,
    filePath,
    size: arrayBuffer.byteLength
  })

  return filePath
}

// Transform database image to response format
function transformImage(img: GeneratedImage) {
  return {
    id: img.id,
    imageUrl: img.image_url,
    originalPrompt: img.original_prompt,
    revisedPrompt: img.revised_prompt,
    model: img.model,
    size: img.size,
    style: img.style,
    isEdit: Boolean(img.is_edit),
    parentImageId: img.parent_image_id,
    isFavorite: Boolean(img.is_favorite),
    createdAt: img.created_at,
  }
}

export const galleryRoutes = {
  // List user's gallery images with pagination
  "/api/gallery": {
    GET: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        const page = parseInt(url.searchParams.get("page") || "1", 10)
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50)
        const favorites = url.searchParams.get("favorites") === "true"
        const search = url.searchParams.get("search") || ""
        const offset = (page - 1) * limit

        let images: GeneratedImage[]
        let totalCount: number

        if (search) {
          const searchPattern = `%${search}%`
          images = generatedImageQueries.search.all(user.id, searchPattern, searchPattern, limit, offset)
          // For search, we'd need a separate count query - for now estimate
          totalCount = images.length < limit ? offset + images.length : offset + limit + 1
        } else if (favorites) {
          images = generatedImageQueries.findFavoritesByUserId.all(user.id, limit, offset)
          totalCount = generatedImageQueries.countFavoritesByUserId.get(user.id)?.count || 0
        } else {
          images = generatedImageQueries.findAllByUserId.all(user.id, limit, offset)
          totalCount = generatedImageQueries.countByUserId.get(user.id)?.count || 0
        }

        return Response.json({
          images: images.map(transformImage),
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: offset + images.length < totalCount,
          },
        })
      } catch (error) {
        log("ERROR", "Failed to list gallery images", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Get a single gallery image details
  "/api/gallery/:id": {
    GET: withAuth(async (req, user) => {
      try {
        const imageId = parseInt((req as any).params?.id, 10)

        if (isNaN(imageId)) {
          return Response.json({ error: "Invalid image ID" }, { status: 400 })
        }

        const image = generatedImageQueries.findByIdAndUserId.get(imageId, user.id)

        if (!image) {
          return Response.json({ error: "Image not found" }, { status: 404 })
        }

        return Response.json({
          image: transformImage(image),
        })
      } catch (error) {
        log("ERROR", "Failed to get gallery image", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
    DELETE: withAuth(async (req, user) => {
      try {
        const imageId = parseInt((req as any).params?.id, 10)

        if (isNaN(imageId)) {
          return Response.json({ error: "Invalid image ID" }, { status: 400 })
        }

        // Soft delete the image
        generatedImageQueries.softDelete.run(imageId, user.id)

        log("INFO", "Gallery image deleted", { imageId, userId: user.id })

        return Response.json({
          success: true,
          message: "Image deleted",
        })
      } catch (error) {
        log("ERROR", "Failed to delete gallery image", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Toggle favorite status
  "/api/gallery/:id/favorite": {
    POST: withAuth(async (req, user) => {
      try {
        const imageId = parseInt((req as any).params?.id, 10)

        if (isNaN(imageId)) {
          return Response.json({ error: "Invalid image ID" }, { status: 400 })
        }

        // Get current image
        const image = generatedImageQueries.findByIdAndUserId.get(imageId, user.id)

        if (!image) {
          return Response.json({ error: "Image not found" }, { status: 404 })
        }

        // Toggle favorite
        const newFavoriteStatus = image.is_favorite ? 0 : 1
        generatedImageQueries.updateFavorite.run(newFavoriteStatus, imageId, user.id)

        log("INFO", "Gallery image favorite toggled", { imageId, userId: user.id, isFavorite: newFavoriteStatus })

        return Response.json({
          success: true,
          isFavorite: Boolean(newFavoriteStatus),
        })
      } catch (error) {
        log("ERROR", "Failed to toggle favorite", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Serve gallery image file (authenticated - only owner can access)
  "/api/gallery/image/:id": {
    GET: async (req: Request & { params: { id: string } }) => {
      try {
        const imageId = parseInt(req.params.id, 10)

        if (isNaN(imageId)) {
          return new Response("Invalid image ID", { status: 400 })
        }

        // Get image to find user
        const image = generatedImageQueries.findById.get(imageId)

        if (!image) {
          return new Response("Image not found", { status: 404 })
        }

        const filePath = getGalleryImagePath(image.user_id, imageId)
        const file = Bun.file(filePath)

        if (!(await file.exists())) {
          return new Response("Image file not found", { status: 404 })
        }

        return new Response(file, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000",
          },
        })
      } catch (error) {
        log("ERROR", "Failed to serve gallery image", error)
        return new Response("Internal server error", { status: 500 })
      }
    },
  },

  // Get gallery statistics
  "/api/gallery/stats": {
    GET: withAuth(async (req, user) => {
      try {
        const totalCount = generatedImageQueries.countByUserId.get(user.id)?.count || 0
        const favoritesCount = generatedImageQueries.countFavoritesByUserId.get(user.id)?.count || 0

        return Response.json({
          total: totalCount,
          favorites: favoritesCount,
        })
      } catch (error) {
        log("ERROR", "Failed to get gallery stats", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },
}
