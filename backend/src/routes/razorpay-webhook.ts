import { log } from "../utils"
import {
  verifyWebhookSignature,
  type RazorpayWebhookPayload,
  type RazorpayWebhookEvent,
} from "../services/razorpay-service"
import {
  getOrderByRazorpayOrderId,
  markOrderPaid,
  updateOrderStatus,
} from "../services/order-service"
import {
  getUserIdBySubscriptionId,
  getUserIdByRazorpayCustomerId,
  activateSubscription,
  updateSubscriptionStatus,
  updateSubscriptionPeriodEnd,
  cancelSubscription,
  pauseSubscription,
  markSubscriptionPastDue,
} from "../services/subscription-service"
import { orderQueries } from "../db"

// Track processed webhook events to ensure idempotency
const processedEvents = new Set<string>()

export const razorpayWebhookRoutes = {
  "/api/razorpay/webhook": {
    POST: async (req: Request) => {
      try {
        // Get the raw body for signature verification
        const rawBody = await req.text()
        const signature = req.headers.get("X-Razorpay-Signature") || ""

        // Verify webhook signature
        if (!verifyWebhookSignature(rawBody, signature)) {
          log("WARN", "Invalid Razorpay webhook signature")
          return Response.json(
            { error: "Invalid webhook signature" },
            { status: 400 }
          )
        }

        // Parse the webhook payload
        let payload: RazorpayWebhookPayload
        try {
          payload = JSON.parse(rawBody)
        } catch {
          log("ERROR", "Invalid webhook payload")
          return Response.json({ error: "Invalid payload" }, { status: 400 })
        }

        // Generate a unique event ID for idempotency
        const eventId = `${payload.event}-${payload.created_at}-${
          payload.payload.payment?.entity?.id ||
          payload.payload.subscription?.entity?.id ||
          payload.payload.order?.entity?.id ||
          "unknown"
        }`

        // Check if we've already processed this event
        if (processedEvents.has(eventId)) {
          log("DEBUG", "Duplicate webhook event ignored", { eventId })
          return Response.json({ success: true, message: "Event already processed" })
        }

        // Add to processed events (with cleanup after 1 hour)
        processedEvents.add(eventId)
        setTimeout(() => processedEvents.delete(eventId), 60 * 60 * 1000)

        log("INFO", "Razorpay webhook received", { event: payload.event })

        // Handle different event types
        switch (payload.event) {
          case "payment.captured":
            await handlePaymentCaptured(payload)
            break

          case "payment.failed":
            await handlePaymentFailed(payload)
            break

          case "subscription.activated":
            await handleSubscriptionActivated(payload)
            break

          case "subscription.charged":
            await handleSubscriptionCharged(payload)
            break

          case "subscription.cancelled":
            await handleSubscriptionCancelled(payload)
            break

          case "subscription.paused":
            await handleSubscriptionPaused(payload)
            break

          case "subscription.resumed":
            await handleSubscriptionResumed(payload)
            break

          case "subscription.pending":
          case "subscription.halted":
            await handleSubscriptionIssue(payload)
            break

          default:
            log("DEBUG", "Unhandled webhook event", { event: payload.event })
        }

        return Response.json({ success: true })
      } catch (error) {
        log("ERROR", "Webhook processing error", error)
        // Return 200 to prevent retries for unrecoverable errors
        return Response.json({ success: false, error: "Processing error" })
      }
    },
  },
}

// Handle payment.captured event
async function handlePaymentCaptured(payload: RazorpayWebhookPayload) {
  const payment = payload.payload.payment?.entity
  if (!payment) {
    log("ERROR", "Payment data missing in webhook")
    return
  }

  log("INFO", "Payment captured", {
    paymentId: payment.id,
    orderId: payment.order_id,
    amount: payment.amount,
  })

  // Find the order by Razorpay order ID
  if (payment.order_id) {
    const order = getOrderByRazorpayOrderId(payment.order_id)
    if (order && order.status === "pending") {
      markOrderPaid(order.id, payment.id)
      log("INFO", "Order marked as paid via webhook", { orderId: order.id })
    }
  }
}

// Handle payment.failed event
async function handlePaymentFailed(payload: RazorpayWebhookPayload) {
  const payment = payload.payload.payment?.entity
  if (!payment) {
    log("ERROR", "Payment data missing in webhook")
    return
  }

  log("WARN", "Payment failed", {
    paymentId: payment.id,
    orderId: payment.order_id,
    error: payment.error_description,
  })

  // Note: We don't update order status here since the user might retry
  // The order will remain in 'pending' status
}

// Handle subscription.activated event
async function handleSubscriptionActivated(payload: RazorpayWebhookPayload) {
  const subscription = payload.payload.subscription?.entity
  if (!subscription) {
    log("ERROR", "Subscription data missing in webhook")
    return
  }

  log("INFO", "Subscription activated", {
    subscriptionId: subscription.id,
    customerId: subscription.customer_id,
  })

  // Find user by subscription ID or customer ID
  let userId = getUserIdBySubscriptionId(subscription.id)
  if (!userId) {
    userId = getUserIdByRazorpayCustomerId(subscription.customer_id)
  }

  if (userId) {
    const periodEnd = subscription.current_end
      ? new Date(subscription.current_end * 1000).toISOString()
      : undefined
    activateSubscription(userId, subscription.id, periodEnd)
    log("INFO", "User subscription activated via webhook", { userId })
  } else {
    log("WARN", "Could not find user for subscription", {
      subscriptionId: subscription.id,
    })
  }
}

// Handle subscription.charged event (recurring payment successful)
async function handleSubscriptionCharged(payload: RazorpayWebhookPayload) {
  const subscription = payload.payload.subscription?.entity
  if (!subscription) {
    log("ERROR", "Subscription data missing in webhook")
    return
  }

  log("INFO", "Subscription charged", {
    subscriptionId: subscription.id,
    currentEnd: subscription.current_end,
  })

  const userId = getUserIdBySubscriptionId(subscription.id)
  if (userId) {
    const periodEnd = subscription.current_end
      ? new Date(subscription.current_end * 1000).toISOString()
      : null
    if (periodEnd) {
      updateSubscriptionPeriodEnd(userId, subscription.id, periodEnd)
    }
    // Ensure status is active
    updateSubscriptionStatus(userId, "active")
    log("INFO", "Subscription period updated via webhook", { userId, periodEnd })
  }
}

// Handle subscription.cancelled event
async function handleSubscriptionCancelled(payload: RazorpayWebhookPayload) {
  const subscription = payload.payload.subscription?.entity
  if (!subscription) {
    log("ERROR", "Subscription data missing in webhook")
    return
  }

  log("INFO", "Subscription cancelled", { subscriptionId: subscription.id })

  const userId = getUserIdBySubscriptionId(subscription.id)
  if (userId) {
    cancelSubscription(userId)
    log("INFO", "User subscription cancelled via webhook", { userId })
  }
}

// Handle subscription.paused event
async function handleSubscriptionPaused(payload: RazorpayWebhookPayload) {
  const subscription = payload.payload.subscription?.entity
  if (!subscription) {
    log("ERROR", "Subscription data missing in webhook")
    return
  }

  log("INFO", "Subscription paused", { subscriptionId: subscription.id })

  const userId = getUserIdBySubscriptionId(subscription.id)
  if (userId) {
    pauseSubscription(userId)
    log("INFO", "User subscription paused via webhook", { userId })
  }
}

// Handle subscription.resumed event
async function handleSubscriptionResumed(payload: RazorpayWebhookPayload) {
  const subscription = payload.payload.subscription?.entity
  if (!subscription) {
    log("ERROR", "Subscription data missing in webhook")
    return
  }

  log("INFO", "Subscription resumed", { subscriptionId: subscription.id })

  const userId = getUserIdBySubscriptionId(subscription.id)
  if (userId) {
    const periodEnd = subscription.current_end
      ? new Date(subscription.current_end * 1000).toISOString()
      : undefined
    activateSubscription(userId, subscription.id, periodEnd)
    log("INFO", "User subscription resumed via webhook", { userId })
  }
}

// Handle subscription issues (pending, halted)
async function handleSubscriptionIssue(payload: RazorpayWebhookPayload) {
  const subscription = payload.payload.subscription?.entity
  if (!subscription) {
    log("ERROR", "Subscription data missing in webhook")
    return
  }

  log("WARN", "Subscription issue", {
    subscriptionId: subscription.id,
    status: subscription.status,
  })

  const userId = getUserIdBySubscriptionId(subscription.id)
  if (userId) {
    // Mark as past_due for payment issues
    markSubscriptionPastDue(userId)
    log("INFO", "User subscription marked as past_due via webhook", { userId })
  }
}
