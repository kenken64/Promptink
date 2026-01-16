import { withAuth } from "../middleware/auth"
import { log } from "../utils"
import {
  getSubscriptionStatus,
  hasActiveSubscription,
  needsToPurchase,
  needsToReactivate,
  cancelSubscription as cancelUserSubscription,
  getRazorpayCustomerId,
  updateRazorpayCustomerId,
  activateSubscription,
  getUserIdBySubscriptionId,
} from "../services/subscription-service"
import {
  cancelRazorpaySubscription,
  createSubscription,
  createCustomer,
  getKeyId,
  getPlanId,
  isConfigured,
  isSubscriptionConfigured,
} from "../services/razorpay-service"
import { hasCompletedOrder } from "../services/order-service"
import { userQueries } from "../db"

export const subscriptionRoutes = {
  // Get subscription status
  "/api/subscription/status": {
    GET: withAuth(async (req, user) => {
      try {
        const result = getSubscriptionStatus(user.id)

        if ("error" in result) {
          return Response.json({ error: result.error }, { status: 500 })
        }

        return Response.json({
          success: true,
          subscription: result.subscription,
        })
      } catch (error) {
        log("ERROR", "Failed to get subscription status", error)
        return Response.json(
          { error: "Failed to get subscription status" },
          { status: 500 }
        )
      }
    }),
  },

  // Cancel subscription
  "/api/subscription/cancel": {
    POST: withAuth(async (req, user) => {
      try {
        // Check if Razorpay is configured
        if (!isConfigured()) {
          return Response.json(
            { error: "Payment system not configured" },
            { status: 503 }
          )
        }

        const subResult = getSubscriptionStatus(user.id)

        if ("error" in subResult) {
          return Response.json({ error: subResult.error }, { status: 500 })
        }

        const { subscription } = subResult

        if (subscription.status !== "active") {
          return Response.json(
            { error: "No active subscription to cancel" },
            { status: 400 }
          )
        }

        if (!subscription.subscriptionId) {
          return Response.json(
            { error: "Subscription ID not found" },
            { status: 400 }
          )
        }

        // Cancel on Razorpay (at end of billing cycle)
        const razorpayResult = await cancelRazorpaySubscription(
          subscription.subscriptionId,
          true // cancel at cycle end
        )

        if ("error" in razorpayResult) {
          log("ERROR", "Failed to cancel Razorpay subscription", razorpayResult.error)
          // Still update local status
        }

        // Update local status
        cancelUserSubscription(user.id)

        log("INFO", "Subscription cancelled", { userId: user.id })

        return Response.json({
          success: true,
          message: "Subscription cancelled. Access will continue until the end of your billing period.",
        })
      } catch (error) {
        log("ERROR", "Failed to cancel subscription", error)
        return Response.json(
          { error: "Failed to cancel subscription" },
          { status: 500 }
        )
      }
    }),
  },

  // Reactivate subscription
  "/api/subscription/reactivate": {
    POST: withAuth(async (req, user) => {
      try {
        // Check if Razorpay subscriptions are configured
        if (!isSubscriptionConfigured()) {
          return Response.json(
            { error: "Subscription system not configured. Please contact support." },
            { status: 503 }
          )
        }

        // Check if user has ever purchased
        const hasPurchased = hasCompletedOrder(user.id)
        if (!hasPurchased) {
          return Response.json(
            { error: "You must purchase a photo frame first" },
            { status: 400 }
          )
        }

        // Check current subscription status
        const subResult = getSubscriptionStatus(user.id)
        if ("error" in subResult) {
          return Response.json({ error: subResult.error }, { status: 500 })
        }

        if (subResult.subscription.status === "active") {
          return Response.json(
            { error: "Subscription is already active" },
            { status: 400 }
          )
        }

        // Get or create Razorpay customer
        let customerId = getRazorpayCustomerId(user.id)

        if (!customerId) {
          const userData = userQueries.findById.get(user.id)
          const customerResult = await createCustomer(
            user.name || user.email,
            user.email,
            undefined,
            { user_id: String(user.id) }
          )

          if ("error" in customerResult) {
            return Response.json(
              { error: "Failed to create payment customer" },
              { status: 500 }
            )
          }

          customerId = customerResult.customer.id
          updateRazorpayCustomerId(user.id, customerId)
        }

        // Create new subscription
        const subscriptionResult = await createSubscription(customerId, undefined, undefined, {
          user_id: String(user.id),
          reactivation: "true",
        })

        if ("error" in subscriptionResult) {
          return Response.json(
            { error: "Failed to create subscription" },
            { status: 500 }
          )
        }

        const sub = subscriptionResult.subscription

        // Return subscription details for frontend to complete payment
        return Response.json({
          success: true,
          subscription: {
            id: sub.id,
            shortUrl: sub.short_url,
          },
          razorpay: {
            subscriptionId: sub.id,
            keyId: getKeyId(),
          },
        })
      } catch (error) {
        log("ERROR", "Failed to reactivate subscription", error)
        return Response.json(
          { error: "Failed to reactivate subscription" },
          { status: 500 }
        )
      }
    }),
  },

  // Create subscription directly (for users who already own a TRMNL device)
  "/api/subscription/create": {
    POST: withAuth(async (req, user) => {
      console.log("[SUB-CREATE] Starting direct subscription creation for user:", user.id)
      try {
        // Check if Razorpay subscriptions are configured (need plan ID)
        if (!isSubscriptionConfigured()) {
          console.log("[SUB-CREATE] ERROR: Razorpay subscription not configured, planId:", getPlanId())
          return Response.json(
            { error: "Subscription system not configured. Please contact support." },
            { status: 503 }
          )
        }
        console.log("[SUB-CREATE] Razorpay is configured, planId:", getPlanId())

        // Check current subscription status
        const subResult = getSubscriptionStatus(user.id)
        if ("error" in subResult) {
          console.log("[SUB-CREATE] ERROR: Failed to get subscription status:", subResult.error)
          return Response.json({ error: subResult.error }, { status: 500 })
        }
        console.log("[SUB-CREATE] Current subscription status:", subResult.subscription.status)

        if (subResult.subscription.status === "active") {
          console.log("[SUB-CREATE] ERROR: User already has active subscription")
          return Response.json(
            { error: "You already have an active subscription" },
            { status: 400 }
          )
        }

        // Get or create Razorpay customer
        let customerId = getRazorpayCustomerId(user.id)
        console.log("[SUB-CREATE] Existing Razorpay customer ID:", customerId)

        if (!customerId) {
          console.log("[SUB-CREATE] Creating new Razorpay customer for:", user.email)
          const customerResult = await createCustomer(
            user.name || user.email,
            user.email,
            undefined,
            { user_id: String(user.id) }
          )

          if ("error" in customerResult) {
            console.log("[SUB-CREATE] ERROR: Failed to create customer:", customerResult.error)
            return Response.json(
              { error: "Failed to create payment customer" },
              { status: 500 }
            )
          }

          customerId = customerResult.customer.id
          console.log("[SUB-CREATE] Created new customer:", customerId)
          updateRazorpayCustomerId(user.id, customerId)
        }

        // Create new subscription
        console.log("[SUB-CREATE] Creating subscription for customer:", customerId)
        const subscriptionResult = await createSubscription(customerId, undefined, undefined, {
          user_id: String(user.id),
          direct_subscription: "true",
        })

        if ("error" in subscriptionResult) {
          console.log("[SUB-CREATE] ERROR: Failed to create subscription:", subscriptionResult.error)
          return Response.json(
            { error: "Failed to create subscription" },
            { status: 500 }
          )
        }

        const sub = subscriptionResult.subscription
        console.log("[SUB-CREATE] Subscription created:", sub.id, "shortUrl:", sub.short_url)

        log("INFO", "Direct subscription created", {
          userId: user.id,
          subscriptionId: sub.id,
        })

        // Return subscription details for frontend to complete payment
        return Response.json({
          success: true,
          subscription: {
            id: sub.id,
            shortUrl: sub.short_url,
          },
          razorpay: {
            subscriptionId: sub.id,
            keyId: getKeyId(),
          },
        })
      } catch (error) {
        console.log("[SUB-CREATE] EXCEPTION:", error)
        log("ERROR", "Failed to create direct subscription", error)
        return Response.json(
          { error: "Failed to create subscription" },
          { status: 500 }
        )
      }
    }),
  },

  // Check access status (for routing decisions)
  "/api/subscription/access": {
    GET: withAuth(async (req, user) => {
      try {
        const mustPurchase = needsToPurchase(user.id)
        const mustReactivate = needsToReactivate(user.id)
        const hasAccess = hasActiveSubscription(user.id)

        return Response.json({
          success: true,
          hasAccess,
          needsToPurchase: mustPurchase,
          needsToReactivate: mustReactivate,
        })
      } catch (error) {
        log("ERROR", "Failed to check access status", error)
        return Response.json(
          { error: "Failed to check access status" },
          { status: 500 }
        )
      }
    }),
  },
}
