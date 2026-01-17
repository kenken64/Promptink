import { useState, useEffect, useCallback } from "react"
import { useAuth } from "./useAuth"

export interface ScheduledJob {
  id: number
  user_id: number
  prompt: string
  size: string
  style_preset: string | null
  schedule_type: "once" | "daily" | "weekly"
  schedule_time: string
  schedule_days: number[] | null
  scheduled_at: string | null
  timezone: string
  is_enabled: number
  auto_sync_trmnl: number
  last_run_at: string | null
  next_run_at: string | null
  run_count: number
  created_at: string
  updated_at: string
}

export interface CreateScheduledJobInput {
  prompt: string
  size?: string
  stylePreset?: string
  scheduleType: "once" | "daily" | "weekly"
  scheduleTime?: string
  scheduleDays?: number[]
  scheduledAt?: string
  timezone?: string
  isEnabled?: boolean
  autoSyncTrmnl?: boolean
}

interface UseScheduleReturn {
  jobs: ScheduledJob[]
  total: number
  limit: number
  isLoading: boolean
  error: string | null
  fetchJobs: () => Promise<void>
  createJob: (input: CreateScheduledJobInput) => Promise<ScheduledJob | null>
  updateJob: (id: number, input: CreateScheduledJobInput) => Promise<ScheduledJob | null>
  deleteJob: (id: number) => Promise<boolean>
  toggleJob: (id: number) => Promise<ScheduledJob | null>
}

export function useSchedule(): UseScheduleReturn {
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { getAuthHeader, logout } = useAuth()

  const fetchJobs = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/schedule", {
        headers: getAuthHeader(),
      })

      if (response.status === 401) {
        logout()
        return
      }

      if (!response.ok) {
        throw new Error("Failed to fetch scheduled jobs")
      }

      const data = await response.json()
      setJobs(data.jobs || [])
      setTotal(data.total || 0)
      setLimit(data.limit || 10)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [getAuthHeader, logout])

  const createJob = useCallback(async (input: CreateScheduledJobInput): Promise<ScheduledJob | null> => {
    setError(null)
    try {
      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(input),
      })

      if (response.status === 401) {
        logout()
        return null
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create scheduled job")
      }

      const job = await response.json()
      setJobs(prev => [job, ...prev])
      setTotal(prev => prev + 1)
      return job
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      return null
    }
  }, [getAuthHeader, logout])

  const updateJob = useCallback(async (id: number, input: CreateScheduledJobInput): Promise<ScheduledJob | null> => {
    setError(null)
    try {
      const response = await fetch(`/api/schedule/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(input),
      })

      if (response.status === 401) {
        logout()
        return null
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update scheduled job")
      }

      const job = await response.json()
      setJobs(prev => prev.map(j => j.id === id ? job : j))
      return job
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      return null
    }
  }, [getAuthHeader, logout])

  const deleteJob = useCallback(async (id: number): Promise<boolean> => {
    setError(null)
    try {
      const response = await fetch(`/api/schedule/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })

      if (response.status === 401) {
        logout()
        return false
      }

      if (!response.ok) {
        throw new Error("Failed to delete scheduled job")
      }

      setJobs(prev => prev.filter(j => j.id !== id))
      setTotal(prev => prev - 1)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      return false
    }
  }, [getAuthHeader, logout])

  const toggleJob = useCallback(async (id: number): Promise<ScheduledJob | null> => {
    setError(null)
    try {
      const response = await fetch(`/api/schedule/${id}/toggle`, {
        method: "POST",
        headers: getAuthHeader(),
      })

      if (response.status === 401) {
        logout()
        return null
      }

      if (!response.ok) {
        throw new Error("Failed to toggle scheduled job")
      }

      const job = await response.json()
      setJobs(prev => prev.map(j => j.id === id ? job : j))
      return job
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      return null
    }
  }, [getAuthHeader, logout])

  // Fetch jobs on mount
  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  return {
    jobs,
    total,
    limit,
    isLoading,
    error,
    fetchJobs,
    createJob,
    updateJob,
    deleteJob,
    toggleJob,
  }
}
