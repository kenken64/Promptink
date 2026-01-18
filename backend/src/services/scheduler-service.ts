import { log } from "../utils"
import { scheduledJobQueries, generatedImageQueries, userQueries, type ScheduledJob } from "../db"
import { generateImage, type GenerateImageOptions } from "./openai-service"
import { saveImageToGallery, getGalleryImageUrl } from "../routes/gallery"
import { syncToTrmnl } from "../routes/sync"

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

function applyStylePreset(prompt: string, stylePreset: string | null): string {
  if (!stylePreset) return prompt
  const modifier = stylePresets[stylePreset] || ""
  if (!modifier) return prompt
  return prompt + modifier
}

// Calculate next run time based on schedule
export function calculateNextRunTime(
  scheduleType: string,
  scheduleTime: string, // HH:MM
  scheduleDays: string | null, // JSON array like "[1,3,5]" for Mon, Wed, Fri
  scheduledAt: string | null, // ISO datetime for 'once' type
  timezone: string
): string | null {
  const now = new Date()
  
  if (scheduleType === 'once') {
    if (!scheduledAt) return null
    const scheduled = new Date(scheduledAt)
    // If already passed, return null (job won't run again)
    return scheduled > now ? scheduledAt : null
  }

  // Parse time
  if (!scheduleTime) return null
  const timeParts = scheduleTime.split(':').map(Number)
  const hours = timeParts[0] ?? 0
  const minutes = timeParts[1] ?? 0
  
  // Create a date for today at the scheduled time
  const nextRun = new Date()
  nextRun.setHours(hours, minutes, 0, 0)

  if (scheduleType === 'daily') {
    // If today's time has passed, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }
    return nextRun.toISOString()
  }

  if (scheduleType === 'weekly') {
    const days = scheduleDays ? JSON.parse(scheduleDays) as number[] : []
    if (days.length === 0) return null

    // Sort days
    days.sort((a, b) => a - b)

    const currentDay = now.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    // Find the next scheduled day
    for (let i = 0; i < 7; i++) {
      const checkDay = (currentDay + i) % 7
      if (days.includes(checkDay)) {
        const candidate = new Date(now)
        candidate.setDate(now.getDate() + i)
        candidate.setHours(hours, minutes, 0, 0)
        
        if (candidate > now) {
          return candidate.toISOString()
        }
      }
    }

    // If we get here, schedule for next week's first day
    const firstDay = days[0] ?? 0
    const daysUntil = (firstDay - currentDay + 7) % 7 || 7
    nextRun.setDate(now.getDate() + daysUntil)
    return nextRun.toISOString()
  }

  return null
}

// Execute a scheduled job
async function executeScheduledJob(job: ScheduledJob): Promise<void> {
  log("INFO", "Executing scheduled job", { jobId: job.id, userId: job.user_id, prompt: job.prompt.substring(0, 50) })

  try {
    // Apply style preset to prompt
    const styledPrompt = applyStylePreset(job.prompt, job.style_preset)

    // Generate the image
    const options: GenerateImageOptions = {
      prompt: styledPrompt,
      model: "dall-e-3",
      size: job.size as any || "1024x1024",
      quality: "standard",
    }

    const result = await generateImage(options)

    if (!result.data?.[0]?.url) {
      throw new Error("No image URL in response")
    }

    // Save to gallery
    const galleryImage = generatedImageQueries.create.get(
      job.user_id,
      result.data[0].url,
      job.prompt,
      result.data[0].revised_prompt || null,
      "dall-e-3",
      job.size || "1024x1024",
      job.style_preset || null,
      0, // is_edit
      null // parent_image_id
    )

    if (galleryImage) {
      await saveImageToGallery(result.data[0].url, job.user_id, galleryImage.id)
      const permanentUrl = getGalleryImageUrl(galleryImage.id)

      // Update the database with the permanent URL (replace expired DALL-E URL)
      generatedImageQueries.updateImageUrl.run(permanentUrl, galleryImage.id)

      log("INFO", "Scheduled image saved to gallery", { 
        jobId: job.id, 
        userId: job.user_id, 
        galleryId: galleryImage.id,
        permanentUrl
      })

      // Auto-sync to TRMNL if enabled
      if (job.auto_sync_trmnl) {
        try {
          const user = userQueries.findById.get(job.user_id)
          if (user?.trmnl_device_api_key && user?.trmnl_mac_address) {
            await syncToTrmnl(permanentUrl, job.prompt, job.user_id)
            log("INFO", "Scheduled image synced to TRMNL", { jobId: job.id, userId: job.user_id })
          }
        } catch (syncError) {
          log("WARN", "Failed to sync scheduled image to TRMNL", syncError)
        }
      }
    }

    // Calculate next run time
    const nextRunAt = calculateNextRunTime(
      job.schedule_type,
      job.schedule_time,
      job.schedule_days,
      job.scheduled_at,
      job.timezone
    )

    // Update job with last run and next run times
    scheduledJobQueries.updateLastRun.run(
      new Date().toISOString(),
      nextRunAt,
      job.id
    )

    // If no next run (one-time job completed), disable it
    if (!nextRunAt) {
      scheduledJobQueries.updateEnabled.run(0, job.id, job.user_id)
      log("INFO", "One-time scheduled job completed and disabled", { jobId: job.id })
    }

  } catch (error) {
    log("ERROR", "Failed to execute scheduled job", { jobId: job.id, error: String(error) })
    throw error
  }
}

// Scheduler interval (runs every minute)
let schedulerInterval: Timer | null = null

// Check and run due jobs
async function checkDueJobs(): Promise<void> {
  const now = new Date().toISOString()
  
  try {
    const dueJobs = scheduledJobQueries.findDueJobs.all(now)
    
    if (dueJobs.length > 0) {
      log("INFO", `Found ${dueJobs.length} due scheduled job(s)`)
    }

    for (const job of dueJobs) {
      try {
        await executeScheduledJob(job)
      } catch (error) {
        // Log error but continue with other jobs
        log("ERROR", "Scheduled job failed", { jobId: job.id, error: String(error) })
      }
    }
  } catch (error) {
    log("ERROR", "Error checking due jobs", error)
  }
}

// Start the scheduler
export function startScheduler(): void {
  if (schedulerInterval) {
    log("WARN", "Scheduler already running")
    return
  }

  log("INFO", "Starting scheduler service")
  
  // Run immediately on startup
  checkDueJobs()

  // Then run every minute
  schedulerInterval = setInterval(checkDueJobs, 60 * 1000)
}

// Stop the scheduler
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    log("INFO", "Scheduler service stopped")
  }
}

// Helper to validate schedule input
export function validateScheduleInput(input: {
  prompt?: string
  scheduleType?: string
  scheduleTime?: string
  scheduleDays?: number[]
  scheduledAt?: string
}): string | null {
  if (!input.prompt || input.prompt.trim().length === 0) {
    return "Prompt is required"
  }

  if (!input.scheduleType || !['once', 'daily', 'weekly'].includes(input.scheduleType)) {
    return "Invalid schedule type. Must be 'once', 'daily', or 'weekly'"
  }

  if (input.scheduleType === 'once') {
    if (!input.scheduledAt) {
      return "Scheduled date/time is required for one-time schedules"
    }
    const scheduledDate = new Date(input.scheduledAt)
    if (isNaN(scheduledDate.getTime())) {
      return "Invalid scheduled date/time format"
    }
    if (scheduledDate <= new Date()) {
      return "Scheduled time must be in the future"
    }
  } else {
    if (!input.scheduleTime || !/^\d{2}:\d{2}$/.test(input.scheduleTime)) {
      return "Schedule time must be in HH:MM format"
    }
    
    const timeParts = input.scheduleTime.split(':').map(Number)
    const hours = timeParts[0]
    const minutes = timeParts[1]
    if (hours === undefined || minutes === undefined || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return "Invalid schedule time"
    }
  }

  if (input.scheduleType === 'weekly') {
    if (!input.scheduleDays || input.scheduleDays.length === 0) {
      return "At least one day must be selected for weekly schedules"
    }
    for (const day of input.scheduleDays) {
      if (day < 0 || day > 6) {
        return "Invalid day value. Days must be 0-6 (Sunday-Saturday)"
      }
    }
  }

  return null // Valid
}
