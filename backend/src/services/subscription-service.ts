import { userQueries, orderQueries, type UserSubscriptionStatus } from "../db"
import { log } from "../utils"
import { hasCompletedOrder, getPaidOrderCount } from "./order-service"

// Subscription status response
export interface SubscriptionStatusResponse {
  status: "none" | "active" | "paused" | "cancelled" | "past_due"
  subscriptionId: string | null
  currentPeriodEnd: string | null
  hasCompletedOrder: boolean
  totalOrdersCount: number
  cancelAtPeriodEnd?: boolean
}

// Get user's subscription status
export function getSubscriptionStatus(
  userId: number
): { subscription: SubscriptionStatusResponse } | { error: string } {
  try {
    const subStatus = userQueries.getSubscriptionStatus.get(userId)
    if (!subStatus) {
      return { error: "User not found" }
    }

    const hasOrder = hasCompletedOrder(userId)
    const orderCount = getPaidOrderCount(userId)
    
    // User has "completed order" if they have a paid order OR they own a TRMNL device
    const hasCompletedOrderOrOwnsTrmnl = hasOrder || subStatus.owns_trmnl_device === 1

    return {
      subscription: {
        status: (subStatus.subscription_status as SubscriptionStatusResponse["status"]) || "none",
        subscriptionId: subStatus.subscription_id,
        currentPeriodEnd: subStatus.subscription_current_period_end,
        hasCompletedOrder: hasCompletedOrderOrOwnsTrmnl,
        totalOrdersCount: orderCount,
      },
    }
  } catch (error) {
    log("ERROR", "Failed to get subscription status", error)
    return { error: "Failed to get subscription status" }
  }
}

// Check if user has an active subscription
export function hasActiveSubscription(userId: number): boolean {
  try {
    const subStatus = userQueries.getSubscriptionStatus.get(userId)
    if (!subStatus) return false
    return subStatus.subscription_status === "active"
  } catch (error) {
    log("ERROR", "Failed to check active subscription", error)
    return false
  }
}

// Check if user needs to purchase first
export function needsToPurchase(userId: number): boolean {
  try {
    // Check if user already owns a TRMNL device (skipped purchase)
    const subStatus = userQueries.getSubscriptionStatus.get(userId)
    if (subStatus?.owns_trmnl_device === 1) {
      return false
    }
    
    const hasOrder = hasCompletedOrder(userId)
    return !hasOrder
  } catch (error) {
    log("ERROR", "Failed to check if user needs to purchase", error)
    return true
  }
}

// Check if user needs to reactivate subscription
export function needsToReactivate(userId: number): boolean {
  try {
    const subStatus = userQueries.getSubscriptionStatus.get(userId)
    if (!subStatus) return false

    const hasOrder = hasCompletedOrder(userId)
    if (!hasOrder) return false // Can't reactivate if never purchased

    const status = subStatus.subscription_status
    return status === "cancelled" || status === "past_due"
  } catch (error) {
    log("ERROR", "Failed to check if user needs to reactivate", error)
    return false
  }
}

// Get user's Razorpay customer ID
export function getRazorpayCustomerId(userId: number): string | null {
  try {
    const subStatus = userQueries.getSubscriptionStatus.get(userId)
    return subStatus?.razorpay_customer_id || null
  } catch (error) {
    log("ERROR", "Failed to get Razorpay customer ID", error)
    return null
  }
}

// Update user's Razorpay customer ID
export function updateRazorpayCustomerId(userId: number, customerId: string): boolean {
  try {
    userQueries.updateRazorpayCustomerId.run(customerId, userId)
    log("INFO", "Updated Razorpay customer ID", { userId, customerId })
    return true
  } catch (error) {
    log("ERROR", "Failed to update Razorpay customer ID", error)
    return false
  }
}

// Activate subscription
export function activateSubscription(
  userId: number,
  subscriptionId: string,
  currentPeriodEnd?: string
): boolean {
  try {
    userQueries.updateSubscription.run(
      subscriptionId,
      "active",
      currentPeriodEnd || null,
      userId
    )
    log("INFO", "Subscription activated", { userId, subscriptionId })
    return true
  } catch (error) {
    log("ERROR", "Failed to activate subscription", error)
    return false
  }
}

// Update subscription status
export function updateSubscriptionStatus(
  userId: number,
  status: "none" | "active" | "paused" | "cancelled" | "past_due"
): boolean {
  try {
    userQueries.updateSubscriptionStatus.run(status, userId)
    log("INFO", "Subscription status updated", { userId, status })
    return true
  } catch (error) {
    log("ERROR", "Failed to update subscription status", error)
    return false
  }
}

// Update subscription period end
export function updateSubscriptionPeriodEnd(
  userId: number,
  subscriptionId: string,
  currentPeriodEnd: string
): boolean {
  try {
    userQueries.updateSubscription.run(
      subscriptionId,
      "active",
      currentPeriodEnd,
      userId
    )
    log("INFO", "Subscription period end updated", { userId, currentPeriodEnd })
    return true
  } catch (error) {
    log("ERROR", "Failed to update subscription period end", error)
    return false
  }
}

// Cancel subscription
export function cancelSubscription(userId: number): boolean {
  try {
    userQueries.updateSubscriptionStatus.run("cancelled", userId)
    log("INFO", "Subscription cancelled", { userId })
    return true
  } catch (error) {
    log("ERROR", "Failed to cancel subscription", error)
    return false
  }
}

// Pause subscription
export function pauseSubscription(userId: number): boolean {
  try {
    userQueries.updateSubscriptionStatus.run("paused", userId)
    log("INFO", "Subscription paused", { userId })
    return true
  } catch (error) {
    log("ERROR", "Failed to pause subscription", error)
    return false
  }
}

// Mark subscription as past due
export function markSubscriptionPastDue(userId: number): boolean {
  try {
    userQueries.updateSubscriptionStatus.run("past_due", userId)
    log("INFO", "Subscription marked as past due", { userId })
    return true
  } catch (error) {
    log("ERROR", "Failed to mark subscription as past due", error)
    return false
  }
}

// Set first order ID (links user to their first paid order)
export function setFirstOrderId(userId: number, orderId: number): boolean {
  try {
    // Check if already set
    const subStatus = userQueries.getSubscriptionStatus.get(userId)
    if (subStatus?.first_order_id) {
      log("DEBUG", "First order ID already set", { userId, existingOrderId: subStatus.first_order_id })
      return true
    }

    userQueries.updateFirstOrderId.run(orderId, userId)
    log("INFO", "First order ID set", { userId, orderId })
    return true
  } catch (error) {
    log("ERROR", "Failed to set first order ID", error)
    return false
  }
}

// Get user ID by Razorpay subscription ID
export function getUserIdBySubscriptionId(subscriptionId: string): number | null {
  try {
    const user = userQueries.findBySubscriptionId.get(subscriptionId)
    return user?.id || null
  } catch (error) {
    log("ERROR", "Failed to get user by subscription ID", error)
    return null
  }
}

// Get user ID by Razorpay customer ID
export function getUserIdByRazorpayCustomerId(customerId: string): number | null {
  try {
    const user = userQueries.findByRazorpayCustomerId.get(customerId)
    return user?.id || null
  } catch (error) {
    log("ERROR", "Failed to get user by Razorpay customer ID", error)
    return null
  }
}

// Set user as owning a TRMNL device (skipping purchase)
export function setOwnsTrmnlDevice(userId: number, owns: boolean): boolean {
  try {
    userQueries.setOwnsTrmnlDevice.run(owns ? 1 : 0, userId)
    log("INFO", "Updated owns_trmnl_device flag", { userId, owns })
    return true
  } catch (error) {
    log("ERROR", "Failed to set owns_trmnl_device flag", error)
    return false
  }
}
