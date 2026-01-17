import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "./useAuth"

export interface BatchJob {
  id: number
  user_id: number
  name: string | null
  status: "pending" | "processing" | "completed" | "failed" | "cancelled"
  total_count: number
  completed_count: number
  failed_count: number
  size: string
  style_preset: string | null
  auto_sync_trmnl: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface BatchJobItem {
  id: number
  batch_id: number
  prompt: string
  status: "pending" | "processing" | "completed" | "failed"
  image_id: number | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface BatchJobWithItems extends BatchJob {
  items: BatchJobItem[]
}

export interface CreateBatchJobInput {
  name?: string
  prompts: string[]
  size?: string
  stylePreset?: string
  autoSyncTrmnl?: boolean
}

export interface BatchStatus {
  id: number
  status: string
  total: number
  completed: number
  failed: number
  progress: number
}

interface UseBatchReturn {
  batches: BatchJob[]
  currentBatch: BatchJobWithItems | null
  isLoading: boolean
  error: string | null
  fetchBatches: () => Promise<void>
  fetchBatch: (id: number) => Promise<BatchJobWithItems | null>
  createBatch: (input: CreateBatchJobInput) => Promise<BatchJob | null>
  cancelBatch: (id: number) => Promise<boolean>
  deleteBatch: (id: number) => Promise<boolean>
  pollStatus: (id: number, onUpdate?: (status: BatchStatus) => void) => void
  stopPolling: () => void
}

export function useBatch(): UseBatchReturn {
  const [batches, setBatches] = useState<BatchJob[]>([])
  const [currentBatch, setCurrentBatch] = useState<BatchJobWithItems | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { getAuthHeader } = useAuth()
  const pollIntervalRef = useRef<NodeJS.Timer | null>(null)

  const fetchBatches = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/batch", {
        headers: getAuthHeader(),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch batch jobs")
      }

      const data = await response.json()
      setBatches(data.batches || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [getAuthHeader])

  const fetchBatch = useCallback(async (id: number): Promise<BatchJobWithItems | null> => {
    setError(null)
    try {
      const response = await fetch(`/api/batch/${id}`, {
        headers: getAuthHeader(),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch batch job")
      }

      const data = await response.json()
      setCurrentBatch(data.batch)
      return data.batch
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      return null
    }
  }, [getAuthHeader])

  const createBatch = useCallback(async (input: CreateBatchJobInput): Promise<BatchJob | null> => {
    setError(null)
    try {
      const response = await fetch("/api/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create batch job")
      }

      const data = await response.json()
      setBatches(prev => [data.batch, ...prev])
      return data.batch
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      return null
    }
  }, [getAuthHeader])

  const cancelBatch = useCallback(async (id: number): Promise<boolean> => {
    setError(null)
    try {
      const response = await fetch(`/api/batch/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ action: "cancel" }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to cancel batch job")
      }

      setBatches(prev => prev.map(b => 
        b.id === id ? { ...b, status: "cancelled" as const } : b
      ))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      return false
    }
  }, [getAuthHeader])

  const deleteBatch = useCallback(async (id: number): Promise<boolean> => {
    setError(null)
    try {
      const response = await fetch(`/api/batch/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete batch job")
      }

      setBatches(prev => prev.filter(b => b.id !== id))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      return false
    }
  }, [getAuthHeader])

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const pollStatus = useCallback((id: number, onUpdate?: (status: BatchStatus) => void) => {
    // Clear any existing polling
    stopPolling()

    const poll = async () => {
      try {
        const response = await fetch(`/api/batch/${id}/status`, {
          headers: getAuthHeader(),
        })

        if (!response.ok) {
          stopPolling()
          return
        }

        const status: BatchStatus = await response.json()
        
        if (onUpdate) {
          onUpdate(status)
        }

        // Update batches list
        setBatches(prev => prev.map(b => 
          b.id === id ? { 
            ...b, 
            status: status.status as BatchJob["status"],
            completed_count: status.completed,
            failed_count: status.failed,
          } : b
        ))

        // Stop polling if batch is done
        if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") {
          stopPolling()
          // Fetch full batch details
          fetchBatch(id)
        }
      } catch (err) {
        console.error("Error polling batch status:", err)
      }
    }

    // Poll immediately and then every 3 seconds
    poll()
    pollIntervalRef.current = setInterval(poll, 3000)
  }, [getAuthHeader, stopPolling, fetchBatch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  // Fetch batches on mount
  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  return {
    batches,
    currentBatch,
    isLoading,
    error,
    fetchBatches,
    fetchBatch,
    createBatch,
    cancelBatch,
    deleteBatch,
    pollStatus,
    stopPolling,
  }
}
