import { log } from "../utils"
import { withAuth } from "../middleware/auth"
import { collectionQueries, collectionImageQueries, generatedImageQueries } from "../db"
import { getGalleryThumbnailUrl } from "./gallery"

export const collectionRoutes = {
  // List user's collections
  "/api/collections": {
    GET: withAuth(async (req, user) => {
      try {
        const collections = collectionQueries.findAllByUserId.all(user.id)

        return Response.json({
          collections: collections.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            imageCount: c.image_count,
            coverThumbnailUrl: c.cover_image_id
              ? getGalleryThumbnailUrl(c.cover_image_id)
              : null,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          })),
        })
      } catch (error) {
        log("ERROR", "Failed to list collections", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
    POST: withAuth(async (req, user) => {
      try {
        const body = await req.json() as { name?: string; description?: string }
        const { name, description } = body

        if (!name || typeof name !== "string" || !name.trim()) {
          return Response.json({ error: "Collection name is required" }, { status: 400 })
        }

        const collection = collectionQueries.create.get(user.id, name.trim(), description?.trim() || null)

        if (!collection) {
          return Response.json({ error: "Failed to create collection" }, { status: 500 })
        }

        log("INFO", "Collection created", { collectionId: collection.id, userId: user.id })

        return Response.json({
          collection: {
            id: collection.id,
            name: collection.name,
            description: collection.description,
            imageCount: 0,
            coverThumbnailUrl: null,
            createdAt: collection.created_at,
            updatedAt: collection.updated_at,
          },
        })
      } catch (error) {
        log("ERROR", "Failed to create collection", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Get, update, or delete a collection
  "/api/collections/:id": {
    GET: withAuth(async (req, user) => {
      try {
        const collectionId = parseInt((req as any).params?.id, 10)
        if (isNaN(collectionId)) {
          return Response.json({ error: "Invalid collection ID" }, { status: 400 })
        }

        const collection = collectionQueries.findByIdAndUserId.get(collectionId, user.id)
        if (!collection) {
          return Response.json({ error: "Collection not found" }, { status: 404 })
        }

        const imageCount = collectionImageQueries.countImagesByCollectionId.get(collectionId)?.count || 0

        return Response.json({
          collection: {
            id: collection.id,
            name: collection.name,
            description: collection.description,
            imageCount,
            coverThumbnailUrl: collection.cover_image_id
              ? getGalleryThumbnailUrl(collection.cover_image_id)
              : null,
            createdAt: collection.created_at,
            updatedAt: collection.updated_at,
          },
        })
      } catch (error) {
        log("ERROR", "Failed to get collection", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
    PATCH: withAuth(async (req, user) => {
      try {
        const collectionId = parseInt((req as any).params?.id, 10)
        if (isNaN(collectionId)) {
          return Response.json({ error: "Invalid collection ID" }, { status: 400 })
        }

        const existing = collectionQueries.findByIdAndUserId.get(collectionId, user.id)
        if (!existing) {
          return Response.json({ error: "Collection not found" }, { status: 404 })
        }

        const body = await req.json() as { name?: string; description?: string }
        const name = body.name !== undefined ? body.name?.trim() : existing.name
        const description = body.description !== undefined ? body.description?.trim() || null : existing.description

        if (!name) {
          return Response.json({ error: "Collection name is required" }, { status: 400 })
        }

        collectionQueries.update.run(name, description, collectionId, user.id)

        log("INFO", "Collection updated", { collectionId, userId: user.id })

        return Response.json({ success: true })
      } catch (error) {
        log("ERROR", "Failed to update collection", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
    DELETE: withAuth(async (req, user) => {
      try {
        const collectionId = parseInt((req as any).params?.id, 10)
        if (isNaN(collectionId)) {
          return Response.json({ error: "Invalid collection ID" }, { status: 400 })
        }

        const existing = collectionQueries.findByIdAndUserId.get(collectionId, user.id)
        if (!existing) {
          return Response.json({ error: "Collection not found" }, { status: 404 })
        }

        collectionQueries.delete.run(collectionId, user.id)

        log("INFO", "Collection deleted", { collectionId, userId: user.id })

        return Response.json({ success: true })
      } catch (error) {
        log("ERROR", "Failed to delete collection", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // List images in a collection
  "/api/collections/:id/images": {
    GET: withAuth(async (req, user) => {
      try {
        const collectionId = parseInt((req as any).params?.id, 10)
        if (isNaN(collectionId)) {
          return Response.json({ error: "Invalid collection ID" }, { status: 400 })
        }

        const collection = collectionQueries.findByIdAndUserId.get(collectionId, user.id)
        if (!collection) {
          return Response.json({ error: "Collection not found" }, { status: 404 })
        }

        const url = new URL(req.url)
        const page = parseInt(url.searchParams.get("page") || "1", 10)
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50)
        const offset = (page - 1) * limit

        const images = collectionImageQueries.findImagesByCollectionId.all(collectionId, limit, offset)
        const totalCount = collectionImageQueries.countImagesByCollectionId.get(collectionId)?.count || 0

        return Response.json({
          images,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: offset + images.length < totalCount,
          },
        })
      } catch (error) {
        log("ERROR", "Failed to list collection images", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
    POST: withAuth(async (req, user) => {
      try {
        const collectionId = parseInt((req as any).params?.id, 10)
        if (isNaN(collectionId)) {
          return Response.json({ error: "Invalid collection ID" }, { status: 400 })
        }

        const collection = collectionQueries.findByIdAndUserId.get(collectionId, user.id)
        if (!collection) {
          return Response.json({ error: "Collection not found" }, { status: 404 })
        }

        const body = await req.json() as { imageId?: number }
        const { imageId } = body

        if (!imageId || typeof imageId !== "number") {
          return Response.json({ error: "imageId is required" }, { status: 400 })
        }

        // Verify the image belongs to the user
        const image = generatedImageQueries.findByIdAndUserId.get(imageId, user.id)
        if (!image) {
          return Response.json({ error: "Image not found" }, { status: 404 })
        }

        collectionImageQueries.addImage.get(collectionId, imageId)

        // Update collection's updated_at
        collectionQueries.update.run(collection.name, collection.description, collectionId, user.id)

        log("INFO", "Image added to collection", { collectionId, imageId, userId: user.id })

        return Response.json({ success: true })
      } catch (error) {
        log("ERROR", "Failed to add image to collection", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Remove image from collection
  "/api/collections/:id/images/:imageId": {
    DELETE: withAuth(async (req, user) => {
      try {
        const collectionId = parseInt((req as any).params?.id, 10)
        const imageId = parseInt((req as any).params?.imageId, 10)

        if (isNaN(collectionId) || isNaN(imageId)) {
          return Response.json({ error: "Invalid IDs" }, { status: 400 })
        }

        const collection = collectionQueries.findByIdAndUserId.get(collectionId, user.id)
        if (!collection) {
          return Response.json({ error: "Collection not found" }, { status: 404 })
        }

        collectionImageQueries.removeImage.run(collectionId, imageId)

        log("INFO", "Image removed from collection", { collectionId, imageId, userId: user.id })

        return Response.json({ success: true })
      } catch (error) {
        log("ERROR", "Failed to remove image from collection", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Get collections containing a specific image
  "/api/collections/for-image/:imageId": {
    GET: withAuth(async (req, user) => {
      try {
        const imageId = parseInt((req as any).params?.imageId, 10)
        if (isNaN(imageId)) {
          return Response.json({ error: "Invalid image ID" }, { status: 400 })
        }

        const results = collectionImageQueries.findCollectionsForImage.all(imageId, user.id)
        const collectionIds = results.map((r) => r.collection_id)

        return Response.json({ collectionIds })
      } catch (error) {
        log("ERROR", "Failed to get collections for image", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },
}
