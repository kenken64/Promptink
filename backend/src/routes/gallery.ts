import { log, toISODate } from "../utils"
import { withAuth } from "../middleware/auth"
import { generatedImageQueries, collectionImageQueries, collectionQueries, type GeneratedImage } from "../db"
import { config } from "../config"
import { mkdirSync, existsSync } from "fs"
import { join } from "path"
import sharp from "sharp"
import JSZip from "jszip"

// Supported export formats
type ExportFormat = "png" | "jpg" | "webp"
const SUPPORTED_FORMATS: ExportFormat[] = ["png", "jpg", "webp"]

// Ensure gallery images directory exists
const GALLERY_DIR = join(config.storage.imagesDir, "gallery")
if (!existsSync(GALLERY_DIR)) {
  mkdirSync(GALLERY_DIR, { recursive: true })
  log("INFO", "Created gallery images directory", { path: GALLERY_DIR })
}

// Ensure thumbnails cache directory exists
const THUMBNAILS_DIR = join(GALLERY_DIR, "thumbnails")
if (!existsSync(THUMBNAILS_DIR)) {
  mkdirSync(THUMBNAILS_DIR, { recursive: true })
  log("INFO", "Created thumbnails cache directory", { path: THUMBNAILS_DIR })
}

// Get the file path for a gallery image
export function getGalleryImagePath(userId: number, imageId: number): string {
  const userDir = join(GALLERY_DIR, `user_${userId}`)
  if (!existsSync(userDir)) {
    mkdirSync(userDir, { recursive: true })
  }
  return join(userDir, `${imageId}.png`)
}

// Get the cached thumbnail path for an image
export function getThumbnailCachePath(userId: number, imageId: number): string {
  const userDir = join(THUMBNAILS_DIR, `user_${userId}`)
  if (!existsSync(userDir)) {
    mkdirSync(userDir, { recursive: true })
  }
  return join(userDir, `${imageId}.webp`)
}

// Get the public URL for a gallery image
export function getGalleryImageUrl(imageId: number): string {
  return `${config.server.baseUrl}/api/gallery/image/${imageId}`
}

// Get the thumbnail URL for a gallery image (smaller, compressed for list views)
export function getGalleryThumbnailUrl(imageId: number): string {
  return `${config.server.baseUrl}/api/gallery/thumbnail/${imageId}`
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
// Uses permanent server URL instead of expired OpenAI URL
function transformImage(img: GeneratedImage) {
  return {
    id: img.id,
    imageUrl: getGalleryImageUrl(img.id), // Full quality image for detail view
    thumbnailUrl: getGalleryThumbnailUrl(img.id), // Compressed thumbnail for list view
    originalPrompt: img.original_prompt,
    revisedPrompt: img.revised_prompt,
    model: img.model,
    size: img.size,
    style: img.style,
    isEdit: Boolean(img.is_edit),
    parentImageId: img.parent_image_id,
    isFavorite: Boolean(img.is_favorite),
    createdAt: toISODate(img.created_at),
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
        const collectionParam = url.searchParams.get("collection")
        const collectionId = collectionParam ? parseInt(collectionParam, 10) : null
        const offset = (page - 1) * limit

        let images: GeneratedImage[]
        let totalCount: number

        if (collectionId && !isNaN(collectionId)) {
          // Verify collection belongs to user
          const collection = collectionQueries.findByIdAndUserId.get(collectionId, user.id)
          if (!collection) {
            return Response.json({ error: "Collection not found" }, { status: 404 })
          }
          images = collectionImageQueries.findImagesByCollectionId.all(collectionId, limit, offset)
          totalCount = collectionImageQueries.countImagesByCollectionId.get(collectionId)?.count || 0
        } else if (search) {
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

  // Serve compressed thumbnail for gallery list view (faster loading on mobile)
  // Uses disk caching to avoid re-generating thumbnails on every request
  "/api/gallery/thumbnail/:id": {
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

        // Check for cached thumbnail first
        const thumbnailPath = getThumbnailCachePath(image.user_id, imageId)
        const cachedThumbnail = Bun.file(thumbnailPath)

        if (await cachedThumbnail.exists()) {
          // Serve from cache - no need to re-generate
          return new Response(cachedThumbnail, {
            headers: {
              "Content-Type": "image/webp",
              "Cache-Control": "public, max-age=31536000",
            },
          })
        }

        // No cached thumbnail, generate from original
        const filePath = getGalleryImagePath(image.user_id, imageId)
        const file = Bun.file(filePath)

        if (!(await file.exists())) {
          return new Response("Image file not found", { status: 404 })
        }

        // Generate compressed thumbnail (300x300 WebP at 60% quality)
        const inputBuffer = Buffer.from(await file.arrayBuffer())
        const thumbnailBuffer = await sharp(inputBuffer)
          .resize(300, 300, {
            fit: "cover",
            position: "center",
          })
          .webp({ quality: 60 })
          .toBuffer()

        // Cache the thumbnail to disk for future requests
        await Bun.write(thumbnailPath, thumbnailBuffer)

        return new Response(thumbnailBuffer, {
          headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "public, max-age=31536000",
          },
        })
      } catch (error) {
        log("ERROR", "Failed to serve gallery thumbnail", error)
        return new Response("Internal server error", { status: 500 })
      }
    },
  },

  // Export/download gallery image with format conversion
  "/api/gallery/export/:id": {
    GET: withAuth(async (req, user) => {
      try {
        const imageId = parseInt((req as any).params?.id, 10)
        const url = new URL(req.url)
        const format = (url.searchParams.get("format") || "png") as ExportFormat
        const quality = Math.min(100, Math.max(1, parseInt(url.searchParams.get("quality") || "85", 10)))
        const width = url.searchParams.get("width") ? parseInt(url.searchParams.get("width")!, 10) : null
        const height = url.searchParams.get("height") ? parseInt(url.searchParams.get("height")!, 10) : null

        if (isNaN(imageId)) {
          return Response.json({ error: "Invalid image ID" }, { status: 400 })
        }

        if (!SUPPORTED_FORMATS.includes(format)) {
          return Response.json({ 
            error: `Unsupported format. Supported: ${SUPPORTED_FORMATS.join(", ")}` 
          }, { status: 400 })
        }

        // Get image and verify ownership
        const image = generatedImageQueries.findByIdAndUserId.get(imageId, user.id)

        if (!image) {
          return Response.json({ error: "Image not found" }, { status: 404 })
        }

        const filePath = getGalleryImagePath(user.id, imageId)
        const file = Bun.file(filePath)

        if (!(await file.exists())) {
          return Response.json({ error: "Image file not found" }, { status: 404 })
        }

        // Read the original image
        const inputBuffer = Buffer.from(await file.arrayBuffer())
        
        // Process with Sharp
        let pipeline = sharp(inputBuffer)

        // Resize if dimensions specified
        if (width || height) {
          pipeline = pipeline.resize(width || undefined, height || undefined, {
            fit: "inside",
            withoutEnlargement: true,
          })
        }

        // Convert to requested format
        let outputBuffer: Buffer
        let contentType: string
        let extension: string

        switch (format) {
          case "jpg":
            outputBuffer = await pipeline.jpeg({ quality }).toBuffer()
            contentType = "image/jpeg"
            extension = "jpg"
            break
          case "webp":
            outputBuffer = await pipeline.webp({ quality }).toBuffer()
            contentType = "image/webp"
            extension = "webp"
            break
          default: // png
            outputBuffer = await pipeline.png().toBuffer()
            contentType = "image/png"
            extension = "png"
        }

        // Generate filename from prompt
        const promptSlug = image.original_prompt
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .substring(0, 30)
          .replace(/-+$/, "")
        const filename = `promptink-${imageId}-${promptSlug}.${extension}`

        log("INFO", "Image exported", { 
          imageId, 
          userId: user.id, 
          format, 
          quality,
          originalSize: inputBuffer.length,
          exportedSize: outputBuffer.length,
        })

        return new Response(outputBuffer, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": outputBuffer.length.toString(),
          },
        })
      } catch (error) {
        log("ERROR", "Failed to export gallery image", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Upload custom image to gallery
  "/api/gallery/upload": {
    POST: withAuth(async (req, user) => {
      try {
        const formData = await req.formData()
        const file = formData.get("image") as File | null
        const description = formData.get("description") as string | null

        if (!file) {
          return Response.json({ error: "No image file provided" }, { status: 400 })
        }

        // Validate file type
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]
        if (!allowedTypes.includes(file.type)) {
          return Response.json({ 
            error: "Invalid file type. Allowed: PNG, JPEG, WebP, GIF" 
          }, { status: 400 })
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024
        if (file.size > maxSize) {
          return Response.json({ 
            error: "File too large. Maximum size is 10MB" 
          }, { status: 400 })
        }

        // Create database record for uploaded image
        const prompt = description || "Uploaded image"
        const result = generatedImageQueries.create.run(
          user.id,
          "", // Will be updated after we have the ID
          prompt,
          null, // no revised prompt for uploads
          "upload", // model = "upload" to identify user uploads
          "original", // size = original
          null, // no style
          0, // not an edit
          null // no parent image
        )

        const imageId = Number(result.lastInsertRowid)

        // Convert image to PNG for consistency and save to user directory
        const inputBuffer = Buffer.from(await file.arrayBuffer())
        const pngBuffer = await sharp(inputBuffer)
          .png()
          .toBuffer()

        const filePath = getGalleryImagePath(user.id, imageId)
        await Bun.write(filePath, pngBuffer)

        // Update the image URL in the database
        const imageUrl = getGalleryImageUrl(imageId)
        generatedImageQueries.updateImageUrl.run(imageUrl, imageId)

        log("INFO", "Image uploaded to gallery", {
          userId: user.id,
          imageId,
          originalType: file.type,
          originalSize: file.size,
          savedSize: pngBuffer.length,
          filePath,
        })

        return Response.json({
          success: true,
          image: {
            id: imageId,
            imageUrl: getGalleryImageUrl(imageId),
            thumbnailUrl: getGalleryThumbnailUrl(imageId),
            originalPrompt: prompt,
            revisedPrompt: null,
            model: "upload",
            size: "original",
            style: null,
            isEdit: false,
            parentImageId: null,
            isFavorite: false,
            createdAt: new Date().toISOString(),
          },
        })
      } catch (error) {
        log("ERROR", "Failed to upload image", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
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

  // Bulk delete images
  "/api/gallery/bulk-delete": {
    POST: withAuth(async (req, user) => {
      try {
        const text = await req.text()
        const { ids } = text ? JSON.parse(text) : {}

        if (!Array.isArray(ids) || ids.length === 0) {
          return Response.json({ error: "ids array is required" }, { status: 400 })
        }

        if (ids.length > 50) {
          return Response.json({ error: "Maximum 50 images per bulk delete" }, { status: 400 })
        }

        if (!ids.every((id: unknown) => Number.isInteger(id) && (id as number) > 0)) {
          return Response.json({ error: "All ids must be positive integers" }, { status: 400 })
        }

        const deletedCount = generatedImageQueries.bulkSoftDelete(ids, user.id)

        log("INFO", "Bulk deleted gallery images", { userId: user.id, requested: ids.length, deletedCount })

        return Response.json({ success: true, deletedCount })
      } catch (error) {
        log("ERROR", "Failed to bulk delete gallery images", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Bulk export images as ZIP
  "/api/gallery/bulk-export": {
    POST: withAuth(async (req, user) => {
      try {
        const text = await req.text()
        const { ids, format: requestedFormat } = text ? JSON.parse(text) : {}
        const format = (requestedFormat || "png") as ExportFormat

        if (!Array.isArray(ids) || ids.length === 0) {
          return Response.json({ error: "ids array is required" }, { status: 400 })
        }

        if (ids.length > 20) {
          return Response.json({ error: "Maximum 20 images per bulk export" }, { status: 400 })
        }

        if (!ids.every((id: unknown) => Number.isInteger(id) && (id as number) > 0)) {
          return Response.json({ error: "All ids must be positive integers" }, { status: 400 })
        }

        if (!SUPPORTED_FORMATS.includes(format)) {
          return Response.json({
            error: `Unsupported format. Supported: ${SUPPORTED_FORMATS.join(", ")}`
          }, { status: 400 })
        }

        // Fetch images and verify ownership
        const images = generatedImageQueries.findByIds(ids, user.id)

        if (images.length === 0) {
          return Response.json({ error: "No images found" }, { status: 404 })
        }

        const zip = new JSZip()

        for (const image of images) {
          const filePath = getGalleryImagePath(user.id, image.id)
          const file = Bun.file(filePath)

          if (!(await file.exists())) continue

          const inputBuffer = Buffer.from(await file.arrayBuffer())

          let outputBuffer: Buffer
          let extension: string

          switch (format) {
            case "jpg":
              outputBuffer = await sharp(inputBuffer).jpeg({ quality: 85 }).toBuffer()
              extension = "jpg"
              break
            case "webp":
              outputBuffer = await sharp(inputBuffer).webp({ quality: 85 }).toBuffer()
              extension = "webp"
              break
            default:
              outputBuffer = await sharp(inputBuffer).png().toBuffer()
              extension = "png"
          }

          const promptSlug = image.original_prompt
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .substring(0, 30)
            .replace(/-+$/, "")
          const filename = `promptink-${image.id}-${promptSlug}.${extension}`

          zip.file(filename, outputBuffer)
        }

        const zipBuffer = await zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        })

        log("INFO", "Bulk exported gallery images", {
          userId: user.id,
          imageCount: images.length,
          format,
          zipSize: zipBuffer.length,
        })

        return new Response(zipBuffer, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="promptink-export-${Date.now()}.zip"`,
            "Content-Length": zipBuffer.length.toString(),
          },
        })
      } catch (error) {
        log("ERROR", "Failed to bulk export gallery images", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Debug endpoint to diagnose gallery issues (protected)
  "/api/gallery/debug": {
    GET: withAuth(async (req, user) => {
      try {
        const { existsSync } = await import("fs")
        const { db } = await import("../db")
        
        // Get ALL images from database (including deleted)
        const allImages = db.prepare(
          "SELECT id, user_id, image_url, original_prompt, is_deleted, is_favorite, created_at FROM generated_images WHERE user_id = ? ORDER BY id"
        ).all(user.id) as { id: number; user_id: number; image_url: string; original_prompt: string; is_deleted: number; is_favorite: number; created_at: string }[]

        const results = allImages.map(img => {
          const filePath = getGalleryImagePath(img.user_id, img.id)
          const fileExists = existsSync(filePath)
          return {
            id: img.id,
            prompt: img.original_prompt?.substring(0, 40) + "...",
            isDeleted: Boolean(img.is_deleted),
            isFavorite: Boolean(img.is_favorite),
            fileExists,
            filePath,
            imageUrl: img.image_url?.substring(0, 60) + "...",
            createdAt: toISODate(img.created_at),
          }
        })

        const summary = {
          totalRecords: allImages.length,
          deletedRecords: allImages.filter(i => i.is_deleted).length,
          activeRecords: allImages.filter(i => !i.is_deleted).length,
          filesExist: results.filter(r => r.fileExists).length,
          filesMissing: results.filter(r => !r.fileExists).length,
          orphaned: results.filter(r => !r.fileExists && !r.isDeleted).length,
        }

        return Response.json({
          userId: user.id,
          summary,
          images: results,
        })
      } catch (error) {
        log("ERROR", "Failed to debug gallery", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },
}
