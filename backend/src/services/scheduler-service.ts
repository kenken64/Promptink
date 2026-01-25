import { log } from "../utils"
import { scheduledJobQueries, generatedImageQueries, userQueries, userDeviceQueries, type ScheduledJob } from "../db"
import { generateImage, type GenerateImageOptions } from "./openai-service"
import { saveImageToGallery, getGalleryImageUrl } from "../routes/gallery"
import { syncToTrmnl } from "../routes/sync"
import { cleanupExpiredTokens } from "./auth-service"

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

// Helper to get current time in a specific timezone
function getNowInTimezone(timezone: string): Date {
  // Get current time as ISO string in the target timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  
  const parts = formatter.formatToParts(new Date())
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
  
  // Create a date object representing "now" in user's timezone
  // We return it as a Date but treat the values as if they're in the user's timezone
  const year = parseInt(get('year'))
  const month = parseInt(get('month')) - 1
  const day = parseInt(get('day'))
  const hour = parseInt(get('hour'))
  const minute = parseInt(get('minute'))
  const second = parseInt(get('second'))
  
  return new Date(year, month, day, hour, minute, second)
}

// Convert a local datetime string in user's timezone to UTC ISO string
function localDatetimeToUTC(localDatetime: string, timezone: string): string {
  // localDatetime is like "2026-01-18T14:36" (no timezone info)
  // We need to interpret this as being in the user's timezone and convert to UTC

  // Parse the local datetime
  const [datePart, timePart] = localDatetime.split('T')
  if (!datePart || !timePart) {
    return new Date().toISOString()
  }
  const dateParts = datePart.split('-').map(Number)
  const timeParts = timePart.split(':').map(Number)
  const year = dateParts[0] ?? 0
  const month = dateParts[1] ?? 1
  const day = dateParts[2] ?? 1
  const hours = timeParts[0] ?? 0
  const minutes = timeParts[1] ?? 0

  // Strategy: Find the timezone offset for this specific date/time in the target timezone
  // This correctly handles DST because we check the offset for the actual date being scheduled

  // First, create a UTC date with these values (treating them as UTC for now)
  const guessUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0))

  // Format this UTC time AS IF it were in the target timezone to see what local time it shows
  const tzFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  // Get what time this UTC timestamp shows in the target timezone
  const parts = tzFormatter.formatToParts(guessUtc)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'

  const tzYear = parseInt(get('year'))
  const tzMonth = parseInt(get('month'))
  const tzDay = parseInt(get('day'))
  const tzHour = parseInt(get('hour'))
  const tzMinute = parseInt(get('minute'))

  // Create Date objects to compute the difference properly
  // tzDate represents what the guessUtc shows as in timezone (treating it as local components)
  // targetDate represents what we actually want in the timezone (the input values)
  const tzDate = new Date(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0)
  const targetDate = new Date(year, month - 1, day, hours, minutes, 0)

  // The difference tells us how much we need to adjust
  // If tzDate < targetDate, the timezone is behind UTC, so we add the difference to guessUtc
  // If tzDate > targetDate, the timezone is ahead of UTC, so we subtract the difference
  const diffMs = targetDate.getTime() - tzDate.getTime()

  // Adjust the UTC time by the difference
  const adjustedUtc = new Date(guessUtc.getTime() + diffMs)

  return adjustedUtc.toISOString()
}

// Calculate next run time based on schedule
export function calculateNextRunTime(
  scheduleType: string,
  scheduleTime: string, // HH:MM (in user's timezone)
  scheduleDays: string | null, // JSON array like "[1,3,5]" for Mon, Wed, Fri
  scheduledAt: string | null, // Local datetime like "2026-01-18T14:36" (in user's timezone)
  timezone: string
): string | null {
  const now = new Date()
  
  if (scheduleType === 'once') {
    if (!scheduledAt) return null
    // Convert local datetime to UTC for storage and comparison
    const scheduledUtc = localDatetimeToUTC(scheduledAt, timezone)
    const scheduled = new Date(scheduledUtc)
    // If already passed, return null (job won't run again)
    return scheduled > now ? scheduledUtc : null
  }

  // For daily/weekly, we need to work in the user's timezone
  if (!scheduleTime) return null
  const timeParts = scheduleTime.split(':').map(Number)
  const hours = timeParts[0] ?? 0
  const minutes = timeParts[1] ?? 0
  
  // Get current time in user's timezone
  const nowInTz = getNowInTimezone(timezone)
  
  // Create next run date in user's timezone
  const nextRunLocal = new Date(nowInTz)
  nextRunLocal.setHours(hours, minutes, 0, 0)

  if (scheduleType === 'daily') {
    // If today's time has passed, schedule for tomorrow
    if (nextRunLocal <= nowInTz) {
      nextRunLocal.setDate(nextRunLocal.getDate() + 1)
    }
    // Convert to UTC for storage
    const localStr = `${nextRunLocal.getFullYear()}-${String(nextRunLocal.getMonth() + 1).padStart(2, '0')}-${String(nextRunLocal.getDate()).padStart(2, '0')}T${String(nextRunLocal.getHours()).padStart(2, '0')}:${String(nextRunLocal.getMinutes()).padStart(2, '0')}`
    return localDatetimeToUTC(localStr, timezone)
  }

  if (scheduleType === 'weekly') {
    const days = scheduleDays ? JSON.parse(scheduleDays) as number[] : []
    if (days.length === 0) return null

    // Sort days
    days.sort((a, b) => a - b)

    const currentDay = nowInTz.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    // Find the next scheduled day
    for (let i = 0; i < 7; i++) {
      const checkDay = (currentDay + i) % 7
      if (days.includes(checkDay)) {
        const candidate = new Date(nowInTz)
        candidate.setDate(nowInTz.getDate() + i)
        candidate.setHours(hours, minutes, 0, 0)
        
        if (candidate > nowInTz) {
          const localStr = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}T${String(candidate.getHours()).padStart(2, '0')}:${String(candidate.getMinutes()).padStart(2, '0')}`
          return localDatetimeToUTC(localStr, timezone)
        }
      }
    }

    // If we get here, schedule for next week's first day
    const firstDay = days[0] ?? 0
    const daysUntil = (firstDay - currentDay + 7) % 7 || 7
    nextRunLocal.setDate(nowInTz.getDate() + daysUntil)
    const localStr = `${nextRunLocal.getFullYear()}-${String(nextRunLocal.getMonth() + 1).padStart(2, '0')}-${String(nextRunLocal.getDate()).padStart(2, '0')}T${String(nextRunLocal.getHours()).padStart(2, '0')}:${String(nextRunLocal.getMinutes()).padStart(2, '0')}`
    return localDatetimeToUTC(localStr, timezone)
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
          // Check if user has any devices configured
          const deviceCount = userDeviceQueries.countByUserId.get(job.user_id)
          if (deviceCount && deviceCount.count > 0) {
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

    // Clear any previous error on successful execution
    scheduledJobQueries.clearError.run(job.id)

    // If no next run (one-time job completed), disable it
    if (!nextRunAt) {
      scheduledJobQueries.updateEnabled.run(0, job.id, job.user_id)
      log("INFO", "One-time scheduled job completed and disabled", { jobId: job.id })
    }

  } catch (error) {
    const errorMessage = String(error).replace(/^Error:\s*/, '')
    log("ERROR", "Failed to execute scheduled job", { jobId: job.id, error: errorMessage })

    // Save the error to the database
    scheduledJobQueries.updateError.run(errorMessage, job.id)

    // Calculate next run time even on failure (for recurring jobs)
    const nextRunAt = calculateNextRunTime(
      job.schedule_type,
      job.schedule_time,
      job.schedule_days,
      job.scheduled_at,
      job.timezone
    )

    // Update next run time so the job can retry
    if (nextRunAt) {
      scheduledJobQueries.updateLastRun.run(
        new Date().toISOString(),
        nextRunAt,
        job.id
      )
    } else {
      // One-time job failed - disable it
      scheduledJobQueries.updateEnabled.run(0, job.id, job.user_id)
      log("INFO", "One-time scheduled job failed and disabled", { jobId: job.id })
    }

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
    
    // Log every check for debugging (can be removed later)
    log("DEBUG", `Scheduler check: now=${now}, found ${dueJobs.length} due job(s)`)
    
    if (dueJobs.length > 0) {
      log("INFO", `Found ${dueJobs.length} due scheduled job(s)`, {
        jobs: dueJobs.map(j => ({ id: j.id, next_run_at: j.next_run_at, prompt: j.prompt.substring(0, 30) }))
      })
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
  cleanupExpiredTokens()

  // Then run every minute
  schedulerInterval = setInterval(checkDueJobs, 60 * 1000)

  // Schedule periodic token cleanup (every hour)
  // Clean up expired tokens from token_blacklist and refresh_tokens tables
  const TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
  setInterval(() => {
    try {
      cleanupExpiredTokens()
    } catch (error) {
      log("ERROR", "Token cleanup failed", error)
    }
  }, TOKEN_CLEANUP_INTERVAL_MS)
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
