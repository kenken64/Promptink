import { log } from "../utils"
import { withAuth } from "../middleware/auth"
import {
  createBatchJob,
  getBatchJobWithItems,
  getUserBatchJobs,
  cancelBatchJob,
  deleteBatchJob,
  MAX_BATCH_SIZE,
} from "../services/batch-service"

export const batchRoutes = {
  // Create a new batch job
  "/api/batch": {
    POST: withAuth(async (req, user) => {
      try {
        const text = await req.text()
        const body = text ? JSON.parse(text) : {}

        if (!body.prompts || !Array.isArray(body.prompts)) {
          return Response.json(
            { error: "prompts array is required" },
            { status: 400 }
          )
        }

        if (body.prompts.length === 0) {
          return Response.json(
            { error: "At least one prompt is required" },
            { status: 400 }
          )
        }

        if (body.prompts.length > MAX_BATCH_SIZE) {
          return Response.json(
            { error: `Maximum ${MAX_BATCH_SIZE} prompts allowed per batch` },
            { status: 400 }
          )
        }

        const batch = createBatchJob({
          userId: user.id,
          name: body.name,
          prompts: body.prompts,
          size: body.size || "1024x1024",
          stylePreset: body.stylePreset,
          autoSyncTrmnl: body.autoSyncTrmnl || false,
        })

        if (!batch) {
          return Response.json(
            { error: "Failed to create batch job" },
            { status: 500 }
          )
        }

        log("INFO", "Batch job created via API", {
          batchId: batch.id,
          userId: user.id,
          promptCount: body.prompts.length,
        })

        return Response.json({ batch })
      } catch (error) {
        log("ERROR", "Failed to create batch job", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),

    // List all batch jobs for the user
    GET: withAuth(async (req, user) => {
      try {
        const batches = getUserBatchJobs(user.id)
        return Response.json({ batches })
      } catch (error) {
        log("ERROR", "Failed to get batch jobs", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Get a specific batch job with items
  "/api/batch/:id": {
    GET: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        const batchId = parseInt(url.pathname.split("/").pop() || "0", 10)
        if (isNaN(batchId)) {
          return Response.json({ error: "Invalid batch ID" }, { status: 400 })
        }

        const batch = getBatchJobWithItems(batchId, user.id)
        if (!batch) {
          return Response.json({ error: "Batch job not found" }, { status: 404 })
        }

        return Response.json({ batch })
      } catch (error) {
        log("ERROR", "Failed to get batch job", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),

    // Cancel a batch job
    PATCH: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        const batchId = parseInt(url.pathname.split("/").pop() || "0", 10)
        if (isNaN(batchId)) {
          return Response.json({ error: "Invalid batch ID" }, { status: 400 })
        }

        const text = await req.text()
        const body = text ? JSON.parse(text) : {}

        if (body.action === "cancel") {
          const cancelled = cancelBatchJob(batchId, user.id)
          if (!cancelled) {
            return Response.json(
              { error: "Cannot cancel batch job (not found or already completed)" },
              { status: 400 }
            )
          }
          return Response.json({ success: true, message: "Batch job cancelled" })
        }

        return Response.json({ error: "Invalid action" }, { status: 400 })
      } catch (error) {
        log("ERROR", "Failed to update batch job", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),

    // Delete a batch job
    DELETE: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        const batchId = parseInt(url.pathname.split("/").pop() || "0", 10)
        if (isNaN(batchId)) {
          return Response.json({ error: "Invalid batch ID" }, { status: 400 })
        }

        const deleted = deleteBatchJob(batchId, user.id)
        if (!deleted) {
          return Response.json(
            { error: "Cannot delete batch job (not found or still processing)" },
            { status: 400 }
          )
        }

        return Response.json({ success: true, message: "Batch job deleted" })
      } catch (error) {
        log("ERROR", "Failed to delete batch job", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },

  // Get batch job status (for polling)
  "/api/batch/:id/status": {
    GET: withAuth(async (req, user) => {
      try {
        const url = new URL(req.url)
        // Extract ID from /api/batch/:id/status
        const pathParts = url.pathname.split("/")
        const batchId = parseInt(pathParts[pathParts.length - 2] || "0", 10)
        if (isNaN(batchId)) {
          return Response.json({ error: "Invalid batch ID" }, { status: 400 })
        }

        const batch = getBatchJobWithItems(batchId, user.id)
        if (!batch) {
          return Response.json({ error: "Batch job not found" }, { status: 404 })
        }

        return Response.json({
          id: batch.id,
          status: batch.status,
          total: batch.total_count,
          completed: batch.completed_count,
          failed: batch.failed_count,
          progress: Math.round(
            ((batch.completed_count + batch.failed_count) / batch.total_count) * 100
          ),
        })
      } catch (error) {
        log("ERROR", "Failed to get batch job status", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }),
  },
}
