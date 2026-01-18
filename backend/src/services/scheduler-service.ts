import { log } from "../utils"
import { scheduledJobQueries, generatedImageQueries, userQueries, type ScheduledJob } from "../db"
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
  // We need to interpret this as being in the user's timezone
  
  // Parse the local datetime
  const [datePart, timePart] = localDatetime.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  
  // Create a formatter to find the UTC offset for this datetime in the target timezone
  const testDate = new Date(Date.UTC(year, month - 1, day, hours, minutes))
  
  // Get the offset by comparing UTC time with the timezone's local time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  // Use a simpler approach: construct the date string with timezone
  // and let Date parse it
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  
  // Create Date in user's timezone by using the timezone in formatting
  // This is a workaround since JS doesn't have great timezone support
  const utcDate = new Date(dateStr + 'Z') // Treat as UTC first
  
  // Get the timezone offset
  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  })
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit', 
    hour: '2-digit', minute: '2-digit', hour12: false
  })
  
  // Find offset by checking what UTC time corresponds to the local time
  // We want to find the UTC time such that when displayed in `timezone`, it shows `localDatetime`
  // Start with assuming the input IS in UTC, then adjust
  const localInTz = tzFormatter.format(utcDate)
  const localParts = localInTz.match(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+)/)
  if (!localParts) {
    return utcDate.toISOString()
  }
  
  const tzMonth = parseInt(localParts[1])
  const tzDay = parseInt(localParts[2])
  const tzYear = parseInt(localParts[3])
  const tzHour = parseInt(localParts[4])
  const tzMinute = parseInt(localParts[5])
  
  // Calculate difference
  const diffMinutes = (hours - tzHour) * 60 + (minutes - tzMinute) + 
                      (day - tzDay) * 24 * 60 +
                      (month - tzMonth) * 30 * 24 * 60 + 
                      (year - tzYear) * 365 * 24 * 60
  
  // Adjust UTC date by the difference
  const adjustedUtc = new Date(utcDate.getTime() + diffMinutes * 60 * 1000)
  
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
