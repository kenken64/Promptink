import { useState } from "react"

interface SyncResult {
  success: boolean
  message: string
  result?: unknown
  webhookUrl?: string
}

interface AuthHeaders {
  Authorization?: string
}

interface UseTrmnlSyncReturn {
  syncToTrmnl: (imageUrl: string, prompt?: string, authHeaders?: AuthHeaders) => Promise<SyncResult>
  isSyncing: boolean
  error: string | null
}

export function useTrmnlSync(): UseTrmnlSyncReturn {
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const syncToTrmnl = async (imageUrl: string, prompt?: string, authHeaders?: AuthHeaders): Promise<SyncResult> => {
    setIsSyncing(true)
    setError(null)

    try {
      const response = await fetch("/api/sync/trmnl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
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
