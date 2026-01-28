import { log, toISODate } from "../utils"
import { withAuth } from "../middleware/auth"
import { db, generatedImageQueries, type GeneratedImage } from "../db"
import { config } from "../config"
import { mkdirSync, existsSync } from "fs"
import { join } from "path"
import { randomBytes } from "crypto"
import { escapeHtml } from "../services/seo-service"
import { getGalleryImageUrl, getGalleryThumbnailUrl } from "./gallery"

// Shared image type
export interface SharedImage {
  id: number
  share_id: string
  user_id: number
  image_url: string
  prompt: string | null
  created_at: string
  expires_at: string | null
  view_count: number
}

// Initialize shared_images table
function initShareTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS shared_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      prompt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      view_count INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)
  db.run(`CREATE INDEX IF NOT EXISTS idx_shared_images_share_id ON shared_images(share_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_shared_images_user_id ON shared_images(user_id)`)
  log("INFO", "Share table initialized")
}

// Initialize on module load
initShareTable()

// Ensure shared images directory exists
const SHARED_IMAGES_DIR = join(config.storage.imagesDir, "shared")
if (!existsSync(SHARED_IMAGES_DIR)) {
  mkdirSync(SHARED_IMAGES_DIR, { recursive: true })
  log("INFO", "Created shared images directory", { path: SHARED_IMAGES_DIR })
}

// Generate a unique share ID
function generateShareId(): string {
  return randomBytes(8).toString("hex")
}

// Get the file path for a shared image
function getSharedImagePath(shareId: string): string {
  return join(SHARED_IMAGES_DIR, `${shareId}.png`)
}

// Get the public URL for a shared image
function getSharedImageUrl(shareId: string): string {
  return `${config.server.baseUrl}/api/share/${shareId}/image`
}

// Get the share page URL
function getSharePageUrl(shareId: string): string {
  return `${config.server.baseUrl}/s/${shareId}`
}

// Download image from URL and save to file
async function downloadAndSaveSharedImage(imageUrl: string, shareId: string): Promise<string> {
  log("INFO", "Downloading image for sharing", { imageUrl: imageUrl.substring(0, 100) + "...", shareId })

  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download image: HTTP ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const filePath = getSharedImagePath(shareId)

  await Bun.write(filePath, arrayBuffer)

  log("INFO", "Shared image saved to file", {
    shareId,
    filePath,
    size: arrayBuffer.byteLength
  })

  return filePath
}

// Prepared statements for shared images
const sharedImageQueries = {
  create: db.prepare<SharedImage, [string, number, string, string | null, string | null]>(
    "INSERT INTO shared_images (share_id, user_id, image_url, prompt, expires_at) VALUES (?, ?, ?, ?, ?) RETURNING *"
  ),
  findByShareId: db.prepare<SharedImage, [string]>(
    "SELECT * FROM shared_images WHERE share_id = ?"
  ),
  findByUserId: db.prepare<SharedImage, [number]>(
    "SELECT * FROM shared_images WHERE user_id = ? ORDER BY created_at DESC"
  ),
  incrementViewCount: db.prepare<void, [string]>(
    "UPDATE shared_images SET view_count = view_count + 1 WHERE share_id = ?"
  ),
  delete: db.prepare<void, [string, number]>(
    "DELETE FROM shared_images WHERE share_id = ? AND user_id = ?"
  ),
}

export const shareRoutes = {
  // Create a shareable link for an image (authenticated)
  "/api/share/create": {
    POST: withAuth(async (req, user) => {
      try {
        const text = await req.text()
        const { imageUrl, prompt, expiresInDays } = text ? JSON.parse(text) : {}

        if (!imageUrl) {
          return Response.json({ error: "imageUrl is required" }, { status: 400 })
        }

        // Generate unique share ID
        const shareId = generateShareId()

        // Download and save image
        try {
          await downloadAndSaveSharedImage(imageUrl, shareId)
        } catch (downloadError) {
          log("ERROR", "Failed to download image for sharing", downloadError)
          return Response.json({ error: `Failed to download image: ${String(downloadError)}` }, { status: 500 })
        }

        // Calculate expiration (default: never expires, can set to 7/30 days)
        let expiresAt: string | null = null
        if (expiresInDays && expiresInDays > 0) {
          const expirationDate = new Date()
          expirationDate.setDate(expirationDate.getDate() + expiresInDays)
          expiresAt = expirationDate.toISOString()
        }

        // Store permanent image URL
        const permanentImageUrl = getSharedImageUrl(shareId)

        // Create database record
        const sharedImage = sharedImageQueries.create.get(
          shareId,
          user.id,
          permanentImageUrl,
          prompt || null,
          expiresAt
        )

        if (!sharedImage) {
          return Response.json({ error: "Failed to create share record" }, { status: 500 })
        }

        log("INFO", "Created shareable image", {
          shareId,
          userId: user.id,
          expiresAt
        })

        return Response.json({
          success: true,
          shareId,
          shareUrl: getSharePageUrl(shareId),
          imageUrl: permanentImageUrl,
          expiresAt,
          socialLinks: {
            twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(getSharePageUrl(shareId))}&text=${encodeURIComponent(`Check out this AI-generated image I created with PromptInk! 🎨`)}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getSharePageUrl(shareId))}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getSharePageUrl(shareId))}`,
            pinterest: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(getSharePageUrl(shareId))}&media=${encodeURIComponent(permanentImageUrl)}&description=${encodeURIComponent(prompt || 'AI-generated image')}`,
            whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out this AI-generated image! ${getSharePageUrl(shareId)}`)}`,
            telegram: `https://t.me/share/url?url=${encodeURIComponent(getSharePageUrl(shareId))}&text=${encodeURIComponent('Check out this AI-generated image!')}`,
          }
        })
      } catch (error) {
        log("ERROR", "Failed to create share", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Get share info (public) and Delete share (authenticated)
  "/api/share/:shareId": {
    GET: async (req: Request & { params: { shareId: string } }) => {
      try {
        const { shareId } = req.params

        const sharedImage = sharedImageQueries.findByShareId.get(shareId)

        if (!sharedImage) {
          return Response.json({ error: "Share not found" }, { status: 404 })
        }

        // Check if expired
        if (sharedImage.expires_at && new Date(sharedImage.expires_at) < new Date()) {
          return Response.json({ error: "This share has expired" }, { status: 410 })
        }

        // Increment view count
        sharedImageQueries.incrementViewCount.run(shareId)

        return Response.json({
          shareId: sharedImage.share_id,
          imageUrl: sharedImage.image_url,
          prompt: sharedImage.prompt,
          createdAt: toISODate(sharedImage.created_at),
          viewCount: sharedImage.view_count + 1,
        })
      } catch (error) {
        log("ERROR", "Failed to get share info", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
    DELETE: withAuth(async (req, user) => {
      try {
        const shareId = (req as any).params?.shareId

        // Delete from database
        sharedImageQueries.delete.run(shareId, user.id)

        // Delete file
        const filePath = getSharedImagePath(shareId)
        const file = Bun.file(filePath)
        if (await file.exists()) {
          const { unlinkSync } = await import("fs")
          try {
            unlinkSync(filePath)
          } catch {}
        }

        log("INFO", "Deleted share", { shareId, userId: user.id })

        return Response.json({
          success: true,
          message: "Share deleted",
        })
      } catch (error) {
        log("ERROR", "Failed to delete share", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Serve shared image file (public)
  "/api/share/:shareId/image": {
    GET: async (req: Request & { params: { shareId: string } }) => {
      try {
        const { shareId } = req.params

        // Validate share exists and not expired
        const sharedImage = sharedImageQueries.findByShareId.get(shareId)

        if (!sharedImage) {
          return new Response("Image not found", { status: 404 })
        }

        if (sharedImage.expires_at && new Date(sharedImage.expires_at) < new Date()) {
          return new Response("This share has expired", { status: 410 })
        }

        const filePath = getSharedImagePath(shareId)
        const file = Bun.file(filePath)

        if (!(await file.exists())) {
          return new Response("Image file not found", { status: 404 })
        }

        log("INFO", "Serving shared image", { shareId, filePath })

        return new Response(file, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000", // Cache for 1 year
          },
        })
      } catch (error) {
        log("ERROR", "Failed to serve shared image", error)
        return new Response("Internal server error", { status: 500 })
      }
    },
  },

  // List user's shared images (authenticated)
  "/api/share/list": {
    GET: withAuth(async (req, user) => {
      try {
        const sharedImages = sharedImageQueries.findByUserId.all(user.id)

        return Response.json({
          shares: sharedImages.map((img: SharedImage) => ({
            shareId: img.share_id,
            shareUrl: getSharePageUrl(img.share_id),
            imageUrl: img.image_url,
            prompt: img.prompt,
            createdAt: toISODate(img.created_at),
            expiresAt: toISODate(img.expires_at),
            viewCount: img.view_count,
          })),
          count: sharedImages.length,
        })
      } catch (error) {
        log("ERROR", "Failed to list shares", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Share page (public) - serves HTML for social media previews
  "/s/:shareId": {
    GET: async (req: Request & { params: { shareId: string } }) => {
      try {
        const { shareId } = req.params

        const sharedImage = sharedImageQueries.findByShareId.get(shareId)

        if (!sharedImage) {
          return new Response("Share not found", { status: 404, headers: { "Content-Type": "text/html" } })
        }

        if (sharedImage.expires_at && new Date(sharedImage.expires_at) < new Date()) {
          return new Response("This share has expired", { status: 410, headers: { "Content-Type": "text/html" } })
        }

        // Increment view count
        sharedImageQueries.incrementViewCount.run(shareId)

        const title = "AI-Generated Image | PromptInk"
        const description = escapeHtml(sharedImage.prompt || "An image created with PromptInk's AI-powered image generator")
        const imageUrl = sharedImage.image_url
        const pageUrl = getSharePageUrl(shareId)

        // Return HTML with Open Graph meta tags for social media previews
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1024">
  <meta property="og:image:height" content="1024">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${pageUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: white;
    }
    .container {
      max-width: 800px;
      width: 100%;
      text-align: center;
    }
    .logo {
      font-size: 1.5rem;
      font-weight: bold;
      margin-bottom: 2rem;
      background: linear-gradient(135deg, #14b8a6, #10b981);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .image-container {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 1.5rem;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    .prompt {
      font-size: 1rem;
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 2rem;
      font-style: italic;
      padding: 0 20px;
    }
    .cta {
      display: inline-block;
      background: linear-gradient(135deg, #14b8a6, #10b981);
      color: white;
      padding: 12px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .cta:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(20, 184, 166, 0.3);
    }
    .views {
      margin-top: 1.5rem;
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.5);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">✨ PromptInk</div>
    <div class="image-container">
      <img src="${imageUrl}" alt="AI-Generated Image">
    </div>
    ${sharedImage.prompt ? `<p class="prompt">"${escapeHtml(sharedImage.prompt)}"</p>` : ''}
    <a href="${config.server.baseUrl}" class="cta">Create Your Own AI Images</a>
    <p class="views">${sharedImage.view_count + 1} views</p>
  </div>
</body>
</html>`

        return new Response(html, {
          headers: {
            "Content-Type": "text/html",
          },
        })
      } catch (error) {
        log("ERROR", "Failed to serve share page", error)
        return new Response("Internal server error", { status: 500, headers: { "Content-Type": "text/html" } })
      }
    },
  },

  // Create a shared gallery from multiple images (authenticated)
  "/api/share/create-gallery": {
    POST: withAuth(async (req, user) => {
      try {
        const text = await req.text()
        const { imageIds, title } = text ? JSON.parse(text) : {}

        if (!Array.isArray(imageIds) || imageIds.length === 0) {
          return Response.json({ error: "imageIds array is required" }, { status: 400 })
        }

        if (imageIds.length > 50) {
          return Response.json({ error: "Maximum 50 images per shared gallery" }, { status: 400 })
        }

        if (!imageIds.every((id: unknown) => Number.isInteger(id) && (id as number) > 0)) {
          return Response.json({ error: "All imageIds must be positive integers" }, { status: 400 })
        }

        // Verify images exist and belong to user
        const images = generatedImageQueries.findByIds(imageIds, user.id)
        if (images.length === 0) {
          return Response.json({ error: "No valid images found" }, { status: 404 })
        }

        const shareId = generateShareId()
        const galleryTitle = title || "Shared Gallery"

        // Insert gallery record
        db.prepare(
          "INSERT INTO shared_galleries (share_id, user_id, title) VALUES (?, ?, ?)"
        ).run(shareId, user.id, galleryTitle)

        // Insert gallery images with sort order
        const insertImage = db.prepare(
          "INSERT INTO shared_gallery_images (gallery_share_id, image_id, sort_order) VALUES (?, ?, ?)"
        )
        for (let i = 0; i < images.length; i++) {
          const img = images[i]!
          insertImage.run(shareId, img.id, i)
        }

        const shareUrl = `${config.server.baseUrl}/s/gallery/${shareId}`

        log("INFO", "Created shared gallery", {
          shareId,
          userId: user.id,
          imageCount: images.length,
        })

        return Response.json({
          success: true,
          shareId,
          shareUrl,
          socialLinks: {
            twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Check out my AI-generated gallery on PromptInk!`)}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
            whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out my AI-generated gallery! ${shareUrl}`)}`,
            telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Check out my AI-generated gallery!')}`,
          }
        })
      } catch (error) {
        log("ERROR", "Failed to create shared gallery", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Shared gallery page (public) - serves HTML with image grid
  "/s/gallery/:shareId": {
    GET: async (req: Request & { params: { shareId: string } }) => {
      try {
        const { shareId } = req.params

        const gallery = db.prepare<{ share_id: string; user_id: number; title: string | null; view_count: number; expires_at: string | null; created_at: string }, [string]>(
          "SELECT * FROM shared_galleries WHERE share_id = ?"
        ).get(shareId)

        if (!gallery) {
          return new Response("Gallery not found", { status: 404, headers: { "Content-Type": "text/html" } })
        }

        if (gallery.expires_at && new Date(gallery.expires_at) < new Date()) {
          return new Response("This gallery has expired", { status: 410, headers: { "Content-Type": "text/html" } })
        }

        // Get images for this gallery
        const galleryImages = db.prepare<GeneratedImage & { sort_order: number }, [string]>(
          `SELECT gi.*, sgi.sort_order FROM generated_images gi
           INNER JOIN shared_gallery_images sgi ON sgi.image_id = gi.id
           WHERE sgi.gallery_share_id = ? AND gi.is_deleted = 0
           ORDER BY sgi.sort_order ASC`
        ).all(shareId)

        // Increment view count
        db.prepare("UPDATE shared_galleries SET view_count = view_count + 1 WHERE share_id = ?").run(shareId)

        const title = escapeHtml(gallery.title || "Shared Gallery") + " | PromptInk"
        const description = `A gallery of ${galleryImages.length} AI-generated images created with PromptInk`
        const pageUrl = `${config.server.baseUrl}/s/gallery/${shareId}`
        const firstImage = galleryImages[0]
        const ogImageUrl = firstImage ? getGalleryImageUrl(firstImage.id) : ""

        const imageCardsHtml = galleryImages.map(img => {
          const imgUrl = getGalleryImageUrl(img.id)
          const thumbUrl = getGalleryThumbnailUrl(img.id)
          const prompt = escapeHtml(img.original_prompt || "")
          return `
            <div class="gallery-item">
              <img src="${thumbUrl}" alt="${prompt}" loading="lazy" onclick="window.open('${imgUrl}', '_blank')">
              ${prompt ? `<p class="caption">${prompt}</p>` : ""}
            </div>`
        }).join("\n")

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  ${ogImageUrl ? `<meta property="og:image" content="${ogImageUrl}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${pageUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${ogImageUrl ? `<meta name="twitter:image" content="${ogImageUrl}">` : ""}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      padding: 20px;
      color: white;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .logo {
      font-size: 1.5rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #14b8a6, #10b981);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .gallery-title { font-size: 1.25rem; color: rgba(255,255,255,0.9); }
    .gallery-meta { font-size: 0.875rem; color: rgba(255,255,255,0.5); margin-top: 0.5rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
    }
    @media (max-width: 640px) {
      .grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    }
    .gallery-item {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      overflow: hidden;
    }
    .gallery-item img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .gallery-item img:hover { transform: scale(1.03); }
    .caption {
      padding: 8px 12px;
      font-size: 0.8rem;
      color: rgba(255,255,255,0.7);
      font-style: italic;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .cta-section { text-align: center; margin-top: 2rem; }
    .cta {
      display: inline-block;
      background: linear-gradient(135deg, #14b8a6, #10b981);
      color: white;
      padding: 12px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .cta:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(20, 184, 166, 0.3);
    }
    .views { margin-top: 1rem; font-size: 0.875rem; color: rgba(255,255,255,0.5); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">PromptInk</div>
      <div class="gallery-title">${escapeHtml(gallery.title || "Shared Gallery")}</div>
      <div class="gallery-meta">${galleryImages.length} images &middot; ${gallery.view_count + 1} views</div>
    </div>
    <div class="grid">
      ${imageCardsHtml}
    </div>
    <div class="cta-section">
      <a href="${config.server.baseUrl}" class="cta">Create Your Own AI Images</a>
      <p class="views">${gallery.view_count + 1} views</p>
    </div>
  </div>
</body>
</html>`

        return new Response(html, {
          headers: { "Content-Type": "text/html" },
        })
      } catch (error) {
        log("ERROR", "Failed to serve shared gallery page", error)
        return new Response("Internal server error", { status: 500, headers: { "Content-Type": "text/html" } })
      }
    },
  },
}
