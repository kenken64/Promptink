import { useState, useEffect, useCallback } from "react"
import { useAuth } from "./useAuth"

interface Device {
  id: number
  name: string
  webhook_url: string | null
  background_color: string
  is_default: boolean
}

interface DeviceResult {
  deviceId: number
  deviceName: string
  success: boolean
  error?: string
}

interface SyncResult {
  success: boolean
  message: string
  deviceResults?: DeviceResult[]
  imageUrl?: string
}

interface UseTrmnlSyncReturn {
  devices: Device[]
  isLoadingDevices: boolean
  hasDevices: boolean
  syncToTrmnl: (imageUrl: string, prompt?: string, deviceIds?: number[]) => Promise<SyncResult>
  isSyncing: boolean
  error: string | null
  refreshDevices: () => Promise<void>
}

export function useTrmnlSync(): UseTrmnlSyncReturn {
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoadingDevices, setIsLoadingDevices] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { authFetch, isAuthenticated } = useAuth()

  const fetchDevices = useCallback(async () => {
    if (!isAuthenticated) {
      setDevices([])
      setIsLoadingDevices(false)
      return
    }

    try {
      const response = await authFetch("/api/devices")
      if (response.ok) {
        const data = await response.json()
        // Only include devices that have webhook URLs configured
        const devicesWithWebhooks = (data.devices || []).filter(
          (d: Device) => d.webhook_url && d.webhook_url.trim() !== ""
        )
        setDevices(devicesWithWebhooks)
      }
    } catch (err) {
      console.error("Failed to fetch devices:", err)
    } finally {
      setIsLoadingDevices(false)
    }
  }, [authFetch, isAuthenticated])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  const syncToTrmnl = async (
    imageUrl: string, 
    prompt?: string, 
    deviceIds?: number[]
  ): Promise<SyncResult> => {
    setIsSyncing(true)
    setError(null)

    try {
      const response = await authFetch("/api/sync/trmnl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          imageUrl, 
          prompt,
          deviceIds: deviceIds && deviceIds.length > 0 ? deviceIds : undefined
        }),
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

  return { 
    devices, 
    isLoadingDevices,
    hasDevices: devices.length > 0,
    syncToTrmnl, 
    isSyncing, 
    error,
    refreshDevices: fetchDevices
  }
}
