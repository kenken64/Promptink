import { useState, useEffect, useCallback } from "react"
import { useAuth } from "./useAuth"

export type SubscriptionStatus = "none" | "active" | "paused" | "cancelled" | "past_due"

export interface SubscriptionInfo {
  status: SubscriptionStatus
  subscriptionId: string | null
  currentPeriodEnd: string | null
  hasCompletedOrder: boolean
  totalOrdersCount: number
  cancelAtPeriodEnd?: boolean
}

export interface AccessStatus {
  hasAccess: boolean
  needsToPurchase: boolean
  needsToReactivate: boolean
}

interface SubscriptionState {
  subscription: SubscriptionInfo | null
  accessStatus: AccessStatus | null
  isLoading: boolean
  error: string | null
}

export function useSubscription() {
  const { authFetch, isAuthenticated } = useAuth()
  const [state, setState] = useState<SubscriptionState>({
    subscription: null,
    accessStatus: null,
    isLoading: true,
    error: null,
  })

  // Fetch subscription status
  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setState((prev) => ({ ...prev, isLoading: false }))
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await authFetch("/api/subscription/status")

      const data = await response.json()

      if (!response.ok || !data.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || "Failed to fetch subscription status",
        }))
        return
      }

      setState((prev) => ({
        ...prev,
        subscription: data.subscription,
        isLoading: false,
        error: null,
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to fetch subscription status",
      }))
    }
  }, [isAuthenticated, authFetch])

  // Fetch access status (for routing)
  const fetchAccessStatus = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const response = await authFetch("/api/subscription/access")

      const data = await response.json()

      if (response.ok && data.success) {
        setState((prev) => ({
          ...prev,
          accessStatus: {
            hasAccess: data.hasAccess,
            needsToPurchase: data.needsToPurchase,
            needsToReactivate: data.needsToReactivate,
          },
        }))
      }
    } catch (error) {
      // Silent fail for access check
    }
  }, [isAuthenticated, authFetch])

  // Cancel subscription
  const cancelSubscription = useCallback(async (): Promise<{
    success: boolean
    error?: string
  }> => {
    try {
      const response = await authFetch("/api/subscription/cancel", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        return { success: false, error: data.error || "Failed to cancel subscription" }
      }

      // Refresh status
      fetchStatus()

      return { success: true }
    } catch (error) {
      return { success: false, error: "Failed to cancel subscription" }
    }
  }, [authFetch, fetchStatus])

  // Reactivate subscription
  const reactivateSubscription = useCallback(async (): Promise<{
    success: boolean
    data?: {
      subscription: { id: string; shortUrl: string }
      razorpay: { subscriptionId: string; keyId: string }
    }
    error?: string
  }> => {
    try {
      const response = await authFetch("/api/subscription/reactivate", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        return { success: false, error: data.error || "Failed to reactivate subscription" }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: "Failed to reactivate subscription" }
    }
  }, [authFetch])

  // Create subscription directly (for users who already own a TRMNL device)
  const createDirectSubscription = useCallback(async (): Promise<{
    success: boolean
    data?: {
      subscription: { id: string; shortUrl: string }
      razorpay: { subscriptionId: string; keyId: string }
    }
    error?: string
  }> => {
    try {
      const response = await authFetch("/api/subscription/create", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        return { success: false, error: data.error || "Failed to create subscription" }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: "Failed to create subscription" }
    }
  }, [authFetch])

  // Helper to check if user has full access
  const hasFullAccess = useCallback((): boolean => {
    if (!state.subscription) return false
    return (
      state.subscription.hasCompletedOrder && state.subscription.status === "active"
    )
  }, [state.subscription])

  // Helper to check if user needs to purchase
  const needsToPurchase = useCallback((): boolean => {
    if (!state.subscription) return true
    return !state.subscription.hasCompletedOrder
  }, [state.subscription])

  // Helper to check if user needs to reactivate
  const needsToReactivate = useCallback((): boolean => {
    if (!state.subscription) return false
    return (
      state.subscription.hasCompletedOrder &&
      (state.subscription.status === "cancelled" ||
        state.subscription.status === "past_due")
    )
  }, [state.subscription])

  // Fetch on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus()
      fetchAccessStatus()
    }
  }, [isAuthenticated, fetchStatus, fetchAccessStatus])

  return {
    subscription: state.subscription,
    accessStatus: state.accessStatus,
    isLoading: state.isLoading,
    error: state.error,
    fetchStatus,
    fetchAccessStatus,
    cancelSubscription,
    reactivateSubscription,
    createDirectSubscription,
    hasFullAccess,
    needsToPurchase,
    needsToReactivate,
  }
}
