import { useState } from "react"
import { useAuth } from "./useAuth"

interface SyncResult {
  success: boolean
  message: string
  result?: unknown
  webhookUrl?: string
}

interface UseTrmnlSyncReturn {
  syncToTrmnl: (imageUrl: string, prompt?: string) => Promise<SyncResult>
  isSyncing: boolean
  error: string | null
}

export function useTrmnlSync(): UseTrmnlSyncReturn {
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { authFetch } = useAuth()

  const syncToTrmnl = async (imageUrl: string, prompt?: string): Promise<SyncResult> => {
    setIsSyncing(true)
    setError(null)

    try {
      const response = await authFetch("/api/sync/trmnl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl, prompt }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to sync to TRMNL")
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed"
      setError(message)
      throw err
    } finally {
      setIsSyncing(false)
    }
  }

  return { syncToTrmnl, isSyncing, error }
}
