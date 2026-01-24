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

export interface SchedulePagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

interface UseScheduleReturn {
  jobs: ScheduledJob[]
  pagination: SchedulePagination | null
  maxJobsAllowed: number
  isLoading: boolean
  error: string | null
  fetchJobs: (page?: number, limit?: number) => Promise<void>
  createJob: (input: CreateScheduledJobInput) => Promise<ScheduledJob | null>
  updateJob: (id: number, input: CreateScheduledJobInput) => Promise<ScheduledJob | null>
  deleteJob: (id: number) => Promise<boolean>
  toggleJob: (id: number) => Promise<ScheduledJob | null>
  nextPage: () => Promise<void>
  prevPage: () => Promise<void>
  goToPage: (page: number) => Promise<void>
}

export function useSchedule(): UseScheduleReturn {
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [pagination, setPagination] = useState<SchedulePagination | null>(null)
  const [maxJobsAllowed, setMaxJobsAllowed] = useState(10)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { authFetch, isAuthenticated, isLoading: authLoading } = useAuth()

  const fetchJobs = useCallback(async (page: number = 1, limit: number = 10) => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const response = await authFetch(`/api/schedule?page=${page}&limit=${limit}`)

      if (!response.ok) {
        throw new Error("Failed to fetch scheduled jobs")
      }

      const data = await response.json()
      setJobs(data.jobs || [])
      setPagination(data.pagination || null)
      setMaxJobsAllowed(data.maxJobsAllowed || 10)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [authFetch, isAuthenticated])

  const nextPage = useCallback(async () => {
    if (pagination && pagination.hasMore) {
      await fetchJobs(pagination.page + 1, pagination.limit)
    }
  }, [pagination, fetchJobs])

  const prevPage = useCallback(async () => {
    if (pagination && pagination.page > 1) {
      await fetchJobs(pagination.page - 1, pagination.limit)
    }
  }, [pagination, fetchJobs])

  const goToPage = useCallback(async (page: number) => {
    if (pagination && page >= 1 && page <= pagination.totalPages) {
      await fetchJobs(page, pagination.limit)
    }
  }, [pagination, fetchJobs])

  const createJob = useCallback(async (input: CreateScheduledJobInput): Promise<ScheduledJob | null> => {
    setError(null)
    try {
      const response = await authFetch("/api/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create scheduled job")
      }

      const job = await response.json()
      setJobs(prev => [job, ...prev])
      // Update pagination total
      setPagination(prev => prev ? { ...prev, total: prev.total + 1, totalPages: Math.ceil((prev.total + 1) / prev.limit) } : null)
      return job
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      return null
    }
  }, [authFetch])

  const updateJob = useCallback(async (id: number, input: CreateScheduledJobInput): Promise<ScheduledJob | null> => {
    setError(null)
    try {
      const response = await authFetch(`/api/schedule/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      })

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
  }, [authFetch])

  const deleteJob = useCallback(async (id: number): Promise<boolean> => {
    setError(null)
    try {
      const response = await authFetch(`/api/schedule/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete scheduled job")
      }

      setJobs(prev => prev.filter(j => j.id !== id))
      // Update pagination total
      setPagination(prev => prev ? { ...prev, total: Math.max(0, prev.total - 1), totalPages: Math.ceil(Math.max(0, prev.total - 1) / prev.limit) } : null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      return false
    }
  }, [authFetch])

  const toggleJob = useCallback(async (id: number): Promise<ScheduledJob | null> => {
    setError(null)
    try {
      const response = await authFetch(`/api/schedule/${id}/toggle`, {
        method: "POST",
      })

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
  }, [authFetch])

  // Fetch jobs on mount (only after auth is loaded)
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchJobs()
    }
  }, [fetchJobs, authLoading, isAuthenticated])

  return {
    jobs,
    pagination,
    maxJobsAllowed,
    isLoading,
    error,
    fetchJobs,
    createJob,
    updateJob,
    deleteJob,
    toggleJob,
    nextPage,
    prevPage,
    goToPage,
  }
}
