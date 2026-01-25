import { log, toISODate } from "../utils"
import { withAuth } from "../middleware/auth"
import { scheduledJobQueries, type ScheduledJob } from "../db"
import { calculateNextRunTime, validateScheduleInput } from "../services/scheduler-service"

// Maximum scheduled jobs per user
const MAX_JOBS_PER_USER = 10

// Default pagination settings
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

// Request body interface for schedule creation/update
interface ScheduleRequestBody {
  prompt?: string
  size?: string
  stylePreset?: string
  scheduleType?: string
  scheduleTime?: string
  scheduleDays?: number[]
  scheduledAt?: string
  timezone?: string
  isEnabled?: boolean
  autoSyncTrmnl?: boolean
}

// Transform scheduled job dates to ISO format with UTC indicator
// Note: scheduled_at is stored as LOCAL time (user's input), not UTC
// We return it as-is so frontend can display without timezone conversion
function transformScheduledJob(job: ScheduledJob) {
  return {
    ...job,
    schedule_days: job.schedule_days ? JSON.parse(job.schedule_days) : null,
    // scheduled_at is LOCAL time - don't add Z suffix
    scheduled_at: job.scheduled_at,
    // These are UTC times - add Z suffix
    last_run_at: toISODate(job.last_run_at),
    next_run_at: toISODate(job.next_run_at),
    created_at: toISODate(job.created_at),
    updated_at: toISODate(job.updated_at),
  }
}

export const scheduleRoutes = {
  // List all scheduled jobs for user (with pagination)
  "/api/schedule": {
    GET: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10))
        const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10)))
        const offset = (page - 1) * limit

        const jobs = scheduledJobQueries.findAllByUserIdPaginated.all(user.id, limit, offset)
        const total = scheduledJobQueries.countByUserId.get(user.id)?.count || 0
        const totalPages = Math.ceil(total / limit)

        // Transform jobs with proper date formats
        const formattedJobs = jobs.map((job: ScheduledJob) => transformScheduledJob(job))

        return Response.json({
          jobs: formattedJobs,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore: page < totalPages,
          },
          maxJobsAllowed: MAX_JOBS_PER_USER,
        })
      } catch (error) {
        log("ERROR", "Failed to list scheduled jobs", error)
        return Response.json({ error: "Failed to list scheduled jobs" }, { status: 500 })
      }
    }),

    // Create a new scheduled job
    POST: withAuth(async (req, user) => {
      try {
        const body = await req.json() as ScheduleRequestBody

        // Check if user has reached the limit
        const count = scheduledJobQueries.countByUserId.get(user.id)?.count || 0
        if (count >= MAX_JOBS_PER_USER) {
          return Response.json(
            { error: `Maximum of ${MAX_JOBS_PER_USER} scheduled jobs allowed` },
            { status: 400 }
          )
        }

        // Validate input
        const validationError = validateScheduleInput(body)
        if (validationError) {
          return Response.json({ error: validationError }, { status: 400 })
        }

        // Calculate next run time
        const scheduleType = body.scheduleType || "daily"
        const nextRunAt = calculateNextRunTime(
          scheduleType,
          body.scheduleTime || "00:00",
          body.scheduleDays ? JSON.stringify(body.scheduleDays) : null,
          body.scheduledAt || null,
          body.timezone || "UTC"
        )

        // Create the job
        const job = scheduledJobQueries.create.get(
          user.id,
          (body.prompt || "").trim(),
          body.size || "1024x1024",
          body.stylePreset || null,
          scheduleType,
          body.scheduleTime || "00:00",
          body.scheduleDays ? JSON.stringify(body.scheduleDays) : null,
          body.scheduledAt || null,
          body.timezone || "UTC",
          body.isEnabled !== false ? 1 : 0,
          body.autoSyncTrmnl ? 1 : 0,
          nextRunAt
        )

        if (!job) {
          return Response.json({ error: "Failed to create scheduled job" }, { status: 500 })
        }

        log("INFO", "Scheduled job created", { jobId: job.id, userId: user.id })

        return Response.json(transformScheduledJob(job), { status: 201 })
      } catch (error) {
        log("ERROR", "Failed to create scheduled job", error)
        return Response.json({ error: "Failed to create scheduled job" }, { status: 500 })
      }
    }),
  },

  // Get, update, or delete a specific scheduled job
  "/api/schedule/:id": {
    GET: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        const id = parseInt(url.pathname.split("/").pop() || "0", 10)

        const job = scheduledJobQueries.findByIdAndUserId.get(id, user.id)
        if (!job) {
          return Response.json({ error: "Scheduled job not found" }, { status: 404 })
        }

        return Response.json(transformScheduledJob(job))
      } catch (error) {
        log("ERROR", "Failed to get scheduled job", error)
        return Response.json({ error: "Failed to get scheduled job" }, { status: 500 })
      }
    }),

    PUT: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        const id = parseInt(url.pathname.split("/").pop() || "0", 10)
        const body = await req.json() as ScheduleRequestBody

        // Check if job exists
        const existing = scheduledJobQueries.findByIdAndUserId.get(id, user.id)
        if (!existing) {
          return Response.json({ error: "Scheduled job not found" }, { status: 404 })
        }

        // Validate input
        const validationError = validateScheduleInput(body)
        if (validationError) {
          return Response.json({ error: validationError }, { status: 400 })
        }

        // Calculate next run time
        const scheduleType = body.scheduleType || existing.schedule_type
        const nextRunAt = calculateNextRunTime(
          scheduleType,
          body.scheduleTime || "00:00",
          body.scheduleDays ? JSON.stringify(body.scheduleDays) : null,
          body.scheduledAt || null,
          body.timezone || "UTC"
        )

        // Update the job
        scheduledJobQueries.update.run(
          body.prompt?.trim() || existing.prompt,
          body.size || "1024x1024",
          body.stylePreset || null,
          scheduleType,
          body.scheduleTime || "00:00",
          body.scheduleDays ? JSON.stringify(body.scheduleDays) : null,
          body.scheduledAt || null,
          body.timezone || "UTC",
          body.isEnabled !== false ? 1 : 0,
          body.autoSyncTrmnl ? 1 : 0,
          nextRunAt,
          id,
          user.id
        )

        // Fetch updated job
        const updated = scheduledJobQueries.findByIdAndUserId.get(id, user.id)

        log("INFO", "Scheduled job updated", { jobId: id, userId: user.id })

        return Response.json(updated ? transformScheduledJob(updated) : null)
      } catch (error) {
        log("ERROR", "Failed to update scheduled job", error)
        return Response.json({ error: "Failed to update scheduled job" }, { status: 500 })
      }
    }),

    DELETE: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        const id = parseInt(url.pathname.split("/").pop() || "0", 10)

        // Check if job exists
        const existing = scheduledJobQueries.findByIdAndUserId.get(id, user.id)
        if (!existing) {
          return Response.json({ error: "Scheduled job not found" }, { status: 404 })
        }

        // Delete the job
        scheduledJobQueries.delete.run(id, user.id)

        log("INFO", "Scheduled job deleted", { jobId: id, userId: user.id })

        return Response.json({ success: true })
      } catch (error) {
        log("ERROR", "Failed to delete scheduled job", error)
        return Response.json({ error: "Failed to delete scheduled job" }, { status: 500 })
      }
    }),
  },

  // Toggle job enabled status
  "/api/schedule/:id/toggle": {
    POST: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        const pathParts = url.pathname.split("/")
        const id = parseInt(pathParts[pathParts.length - 2] || "0", 10)

        // Check if job exists
        const existing = scheduledJobQueries.findByIdAndUserId.get(id, user.id)
        if (!existing) {
          return Response.json({ error: "Scheduled job not found" }, { status: 404 })
        }

        // Toggle enabled status
        const newEnabled = existing.is_enabled ? 0 : 1
        scheduledJobQueries.updateEnabled.run(newEnabled, id, user.id)

        // If re-enabling, recalculate next run time
        if (newEnabled === 1) {
          const nextRunAt = calculateNextRunTime(
            existing.schedule_type,
            existing.schedule_time,
            existing.schedule_days,
            existing.scheduled_at,
            existing.timezone
          )
          if (nextRunAt) {
            scheduledJobQueries.updateLastRun.run(
              existing.last_run_at || new Date().toISOString(),
              nextRunAt,
              id
            )
          }
        }

        log("INFO", "Scheduled job toggled", { jobId: id, userId: user.id, enabled: newEnabled })

        // Fetch updated job
        const updated = scheduledJobQueries.findByIdAndUserId.get(id, user.id)

        return Response.json(updated ? transformScheduledJob(updated) : null)
      } catch (error) {
        log("ERROR", "Failed to toggle scheduled job", error)
        return Response.json({ error: "Failed to toggle scheduled job" }, { status: 500 })
      }
    }),
  },

  // Debug endpoint to check scheduler status
  "/api/schedule/debug": {
    GET: withAuth(async (req, user) => {
      try {
        const now = new Date().toISOString()
        const jobs = scheduledJobQueries.findAllByUserId.all(user.id)
        
        const debugInfo = jobs.map(job => ({
          id: job.id,
          prompt: job.prompt.substring(0, 50),
          schedule_type: job.schedule_type,
          is_enabled: job.is_enabled,
          next_run_at: toISODate(job.next_run_at),
          timezone: job.timezone,
          is_due: job.is_enabled === 1 && job.next_run_at && job.next_run_at <= now,
          server_time_utc: now,
        }))

        return Response.json({
          server_time_utc: now,
          jobs: debugInfo,
        })
      } catch (error) {
        log("ERROR", "Failed to get schedule debug info", error)
        return Response.json({ error: "Failed to get debug info" }, { status: 500 })
      }
    }),
  },
}
