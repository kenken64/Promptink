import { log, toISODate } from "../utils"
import {
  batchJobQueries,
  batchJobItemQueries,
  generatedImageQueries,
  type BatchJob,
  type BatchJobItem,
} from "../db"
import { generateImage, type GenerateImageOptions } from "./openai-service"
import { saveImageToGallery, getGalleryImageUrl } from "../routes/gallery"
import { syncToTrmnl } from "../routes/sync"

// Transform batch job dates to ISO format with UTC indicator
function transformBatchJob(batch: BatchJob): BatchJob {
  return {
    ...batch,
    created_at: toISODate(batch.created_at) || batch.created_at,
    started_at: toISODate(batch.started_at),
    completed_at: toISODate(batch.completed_at),
  }
}

// Transform batch job item dates to ISO format with UTC indicator
function transformBatchItem(item: BatchJobItem): BatchJobItem {
  return {
    ...item,
    created_at: toISODate(item.created_at) || item.created_at,
    completed_at: toISODate(item.completed_at),
  }
}

// Style preset definitions (same as in images.ts)
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
function applyStylePreset(prompt: string, stylePreset: string | null): string {
  if (!stylePreset) return prompt
  const modifier = stylePresets[stylePreset] || ""
  if (!modifier) return prompt
  return prompt + modifier
}

// Maximum items per batch
export const MAX_BATCH_SIZE = 10

// Rate limiting: 30 second delay between each image generation to avoid OpenAI rate limits
const RATE_LIMIT_DELAY_MS = 30000

// TRMNL sync delay: 10 minutes between each sync to stagger updates
const TRMNL_SYNC_DELAY_MS = 10 * 60 * 1000 // 10 minutes

// Batch processor singleton
let isProcessing = false
let processorInterval: Timer | null = null
let lastImageGeneratedAt: number = 0
let lastSyncToTrmnlAt: number = 0

// Queue for pending TRMNL syncs (imageUrl, prompt, userId, batchId, itemId)
interface PendingSync {
  imageUrl: string
  prompt: string
  userId: number
  batchId: number
  itemId: number
}
let pendingSyncs: PendingSync[] = []

// Start the batch processor
export function startBatchProcessor(intervalMs: number = 5000): void {
  if (processorInterval) {
    log("WARN", "Batch processor already running")
    return
  }

  // Check for any in-progress batches that need to be resumed (e.g., after server restart)
  const pendingBatch = batchJobQueries.findPending.get()
  if (pendingBatch) {
    log("INFO", "Found in-progress batch job to resume", { 
      batchId: pendingBatch.id, 
      status: pendingBatch.status,
      completed: pendingBatch.completed_count,
      total: pendingBatch.total_count
    })
  }

  log("INFO", "Starting batch processor", { intervalMs, rateLimitDelayMs: RATE_LIMIT_DELAY_MS, trmnlSyncDelayMs: TRMNL_SYNC_DELAY_MS })

  processorInterval = setInterval(async () => {
    await processPendingSyncs()
    await processPendingBatches()
  }, intervalMs)

  // Run immediately on start
  processPendingSyncs()
  processPendingBatches()
}

// Stop the batch processor
export function stopBatchProcessor(): void {
  if (processorInterval) {
    clearInterval(processorInterval)
    processorInterval = null
    log("INFO", "Batch processor stopped")
  }
}

// Process pending TRMNL syncs with 10-minute delay between each
async function processPendingSyncs(): Promise<void> {
  if (pendingSyncs.length === 0) {
    return
  }

  const now = Date.now()
  const timeSinceLastSync = now - lastSyncToTrmnlAt

  // Check if 10 minutes have passed since last sync
  if (lastSyncToTrmnlAt > 0 && timeSinceLastSync < TRMNL_SYNC_DELAY_MS) {
    const remainingMs = TRMNL_SYNC_DELAY_MS - timeSinceLastSync
    const remainingMin = Math.ceil(remainingMs / 60000)
    log("DEBUG", `TRMNL sync delayed, ${remainingMin} min remaining`, { 
      pendingCount: pendingSyncs.length 
    })
    return
  }

  // Process the next sync in queue
  const sync = pendingSyncs.shift()
  if (!sync) return

  try {
    await syncToTrmnl(sync.imageUrl, sync.prompt, sync.userId)
    lastSyncToTrmnlAt = Date.now()
    // Mark the item as synced to TRMNL
    batchJobItemQueries.markSyncedToTrmnl.run(sync.itemId)
    log("INFO", "Batch image synced to TRMNL (delayed)", { 
      batchId: sync.batchId, 
      itemId: sync.itemId,
      remainingInQueue: pendingSyncs.length
    })
  } catch (syncError) {
    log("WARN", "Failed to sync batch image to TRMNL", syncError)
  }
}

// Process pending batch jobs
async function processPendingBatches(): Promise<void> {
  if (isProcessing) {
    return
  }

  // Rate limiting: Check if 30 seconds have passed since last image generation
  const now = Date.now()
  const timeSinceLastGeneration = now - lastImageGeneratedAt
  if (lastImageGeneratedAt > 0 && timeSinceLastGeneration < RATE_LIMIT_DELAY_MS) {
    // Not enough time has passed, skip this cycle
    return
  }

  try {
    isProcessing = true

    // Find the next pending or in-progress batch
    const batch = batchJobQueries.findPending.get()
    if (!batch) {
      return
    }

    log("INFO", "Processing batch job", { batchId: batch.id, status: batch.status })

    // Mark as processing if still pending
    if (batch.status === "pending") {
      batchJobQueries.updateStarted.run(batch.id)
    }

    // Process the next pending item in this batch
    await processNextBatchItem(batch)

  } catch (error) {
    log("ERROR", "Error in batch processor", error)
  } finally {
    isProcessing = false
  }
}

// Process the next item in a batch
async function processNextBatchItem(batch: BatchJob): Promise<void> {
  const item = batchJobItemQueries.findPendingByBatchId.get(batch.id)

  if (!item) {
    // No more items to process - fetch fresh batch data to get accurate counts
    const freshBatch = batchJobQueries.findById.get(batch.id)
    if (!freshBatch) {
      log("ERROR", "Batch not found when trying to mark as complete", { batchId: batch.id })
      return
    }

    // Determine status based on fresh counts
    const status = freshBatch.failed_count > 0 && freshBatch.completed_count === 0
      ? "failed"
      : "completed"
    batchJobQueries.updateCompleted.run(status, batch.id)
    log("INFO", "Batch job completed", {
      batchId: batch.id,
      status,
      completed: freshBatch.completed_count,
      failed: freshBatch.failed_count
    })
    return
  }

  log("INFO", "Processing batch item", { batchId: batch.id, itemId: item.id })

  try {
    // Apply style preset
    const styledPrompt = applyStylePreset(item.prompt, batch.style_preset)

    // Generate the image
    const options: GenerateImageOptions = {
      prompt: styledPrompt,
      model: "dall-e-3",
      size: batch.size as any,
      response_format: "url",
    }

    const result = await generateImage(options)
    
    // Update rate limit timestamp after API call
    lastImageGeneratedAt = Date.now()

    if (!result.data?.[0]?.url) {
      throw new Error("No image URL in response")
    }

    // Save to gallery
    const galleryImage = generatedImageQueries.create.get(
      batch.user_id,
      result.data[0].url, // Temporary URL
      item.prompt,
      result.data[0].revised_prompt || null,
      "dall-e-3",
      batch.size,
      null, // style (DALL-E style param)
      0, // is_edit
      null // parent_image_id
    )

    if (!galleryImage) {
      throw new Error("Failed to create gallery record")
    }

    // Download and save the image
    await saveImageToGallery(result.data[0].url, batch.user_id, galleryImage.id)
    
    // Update the database with the permanent URL (replace expired DALL-E URL)
    const permanentUrl = getGalleryImageUrl(galleryImage.id)
    generatedImageQueries.updateImageUrl.run(permanentUrl, galleryImage.id)

    // Auto-sync to TRMNL if enabled
    if (batch.auto_sync_trmnl === 1) {
      // First image syncs immediately, subsequent ones are queued with 10-min delay
      if (lastSyncToTrmnlAt === 0) {
        // First sync - do it immediately
        try {
          await syncToTrmnl(permanentUrl, item.prompt, batch.user_id)
          lastSyncToTrmnlAt = Date.now()
          // Mark the item as synced to TRMNL
          batchJobItemQueries.markSyncedToTrmnl.run(item.id)
          log("INFO", "Batch image synced to TRMNL (first/immediate)", { 
            batchId: batch.id, 
            itemId: item.id,
            imageId: galleryImage.id 
          })
        } catch (syncError) {
          log("WARN", "Failed to sync batch image to TRMNL", syncError)
        }
      } else {
        // Queue for delayed sync (10 min between each)
        pendingSyncs.push({
          imageUrl: permanentUrl,
          prompt: item.prompt,
          userId: batch.user_id,
          batchId: batch.id,
          itemId: item.id
        })
        log("INFO", "Batch image queued for TRMNL sync", { 
          batchId: batch.id, 
          itemId: item.id,
          imageId: galleryImage.id,
          queuePosition: pendingSyncs.length
        })
      }
    }

    // Update item as completed
    batchJobItemQueries.updateCompleted.run("completed", galleryImage.id, null, item.id)

    // Update batch progress atomically
    batchJobQueries.incrementCompleted.run(batch.id)

    log("INFO", "Batch item completed", {
      batchId: batch.id,
      itemId: item.id,
      imageId: galleryImage.id
    })

  } catch (error) {
    // Update rate limit timestamp even on failure (API call was still made)
    lastImageGeneratedAt = Date.now()
    
    const errorMessage = String(error)
    log("ERROR", "Failed to process batch item", { 
      batchId: batch.id, 
      itemId: item.id, 
      error: errorMessage 
    })

    // Update item as failed
    batchJobItemQueries.updateCompleted.run("failed", null, errorMessage, item.id)

    // Update batch progress atomically
    batchJobQueries.incrementFailed.run(batch.id)
  }
}

// Create a new batch job
export interface CreateBatchJobInput {
  userId: number
  name?: string | null
  prompts: string[]
  size: string
  stylePreset?: string | null
  autoSyncTrmnl?: boolean
}

export function createBatchJob(input: CreateBatchJobInput): BatchJob | null {
  const { userId, name, prompts, size, stylePreset, autoSyncTrmnl = false } = input

  if (prompts.length === 0) {
    throw new Error("At least one prompt is required")
  }

  if (prompts.length > MAX_BATCH_SIZE) {
    throw new Error(`Maximum ${MAX_BATCH_SIZE} prompts allowed per batch`)
  }

  // Validate prompts are not empty
  const validPrompts = prompts.filter(p => p.trim().length > 0)
  if (validPrompts.length === 0) {
    throw new Error("At least one non-empty prompt is required")
  }

  // Create the batch job
  const batch = batchJobQueries.create.get(
    userId,
    name || null,
    validPrompts.length,
    size,
    stylePreset || null,
    autoSyncTrmnl ? 1 : 0
  )

  if (!batch) {
    throw new Error("Failed to create batch job")
  }

  // Create items for each prompt
  for (const prompt of validPrompts) {
    batchJobItemQueries.create.get(batch.id, prompt.trim())
  }

  log("INFO", "Batch job created", {
    batchId: batch.id,
    userId,
    totalPrompts: validPrompts.length,
    stylePreset,
    autoSyncTrmnl
  })

  return transformBatchJob(batch)
}

// Get batch job with items
export interface BatchJobWithItems extends BatchJob {
  items: BatchJobItem[]
}

export function getBatchJobWithItems(batchId: number, userId: number): BatchJobWithItems | null {
  const batch = batchJobQueries.findByIdAndUserId.get(batchId, userId)
  if (!batch) {
    return null
  }

  const items = batchJobItemQueries.findByBatchId.all(batch.id)
  return {
    ...transformBatchJob(batch),
    items: items.map(transformBatchItem),
  }
}

// Get all batch jobs for a user
export function getUserBatchJobs(userId: number): BatchJob[] {
  return batchJobQueries.findAllByUserId.all(userId).map(transformBatchJob)
}

// Get batch jobs for a user with pagination
export function getUserBatchJobsPaginated(
  userId: number,
  limit: number,
  offset: number
): { batches: BatchJob[]; total: number } {
  const batches = batchJobQueries.findAllByUserIdPaginated.all(userId, limit, offset).map(transformBatchJob)
  const countResult = batchJobQueries.countByUserId.get(userId)
  const total = countResult?.count || 0
  return { batches, total }
}

// Cancel a batch job
export function cancelBatchJob(batchId: number, userId: number): boolean {
  const batch = batchJobQueries.findByIdAndUserId.get(batchId, userId)
  if (!batch) {
    return false
  }

  if (batch.status === "completed" || batch.status === "cancelled") {
    return false
  }

  batchJobQueries.updateStatus.run("cancelled", batch.id)
  log("INFO", "Batch job cancelled", { batchId })
  return true
}

// Delete a batch job
export function deleteBatchJob(batchId: number, userId: number): boolean {
  const batch = batchJobQueries.findByIdAndUserId.get(batchId, userId)
  if (!batch) {
    return false
  }

  // Only allow deletion of completed/cancelled/failed batches
  if (batch.status === "pending" || batch.status === "processing") {
    return false
  }

  batchJobQueries.delete.run(batchId, userId)
  log("INFO", "Batch job deleted", { batchId })
  return true
}
