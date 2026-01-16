import { withAuth } from "../middleware/auth"
import { log } from "../utils"
import {
  createOrder,
  getOrderById,
  getOrdersByUserId,
  getOrderByRazorpayOrderId,
  updateOrderRazorpayId,
  markOrderPaid,
  hasCompletedOrder,
  isFirstPaidOrder,
  type CreateOrderInput,
} from "../services/order-service"
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  createCustomer,
  createSubscription,
  getKeyId,
  isConfigured,
} from "../services/razorpay-service"
import {
  getRazorpayCustomerId,
  updateRazorpayCustomerId,
  activateSubscription,
  setFirstOrderId,
  getSubscriptionStatus,
} from "../services/subscription-service"
import { userQueries } from "../db"

export const orderRoutes = {
  // Create a new order
  "/api/orders": {
    // List all orders for the authenticated user
    GET: withAuth(async (req, user) => {
      try {
        const result = getOrdersByUserId(user.id)

        if ("error" in result) {
          return Response.json({ error: result.error }, { status: 400 })
        }

        return Response.json({
          success: true,
          orders: result.orders,
        })
      } catch (error) {
        log("ERROR", "Failed to list orders", error)
        return Response.json({ error: "Failed to list orders" }, { status: 500 })
      }
    }),

    // Create a new order
    POST: withAuth(async (req, user) => {
      try {
        // Check if Razorpay is configured
        if (!isConfigured()) {
          return Response.json(
            { error: "Payment system not configured" },
            { status: 503 }
          )
        }

        const text = await req.text()
        const body = text ? JSON.parse(text) : {}

        const { quantity, shipping, gift } = body

        if (!quantity || !shipping) {
          return Response.json(
            { error: "Quantity and shipping details are required" },
            { status: 400 }
          )
        }

        // Check if user has existing active subscription
        const subStatus = getSubscriptionStatus(user.id)
        const hasExistingSubscription =
          "subscription" in subStatus && subStatus.subscription.status === "active"

        // Create the order in our database
        const orderInput: CreateOrderInput = {
          userId: user.id,
          quantity,
          hasExistingSubscription,
          shipping: {
            name: shipping.name,
            email: shipping.email,
            phone: shipping.phone,
            addressLine1: shipping.addressLine1,
            addressLine2: shipping.addressLine2,
            city: shipping.city,
            state: shipping.state,
            postalCode: shipping.postalCode,
            country: shipping.country,
          },
          gift: gift
            ? {
                isGift: gift.isGift,
                recipientName: gift.recipientName,
                message: gift.message,
              }
            : undefined,
        }

        const orderResult = createOrder(orderInput)

        if ("error" in orderResult) {
          return Response.json({ error: orderResult.error }, { status: 400 })
        }

        const order = orderResult.order

        log("INFO", "Order created, creating Razorpay order", {
          orderId: order.id,
          totalAmount: order.totalAmount,
          currency: order.currency,
          hasExistingSubscription,
        })

        // Create Razorpay order
        const razorpayResult = await createRazorpayOrder(
          order.totalAmount,
          order.currency,
          order.orderNumber,
          {
            user_id: String(user.id),
            order_id: String(order.id),
          }
        )

        if ("error" in razorpayResult) {
          return Response.json({ error: razorpayResult.error }, { status: 500 })
        }

        // Update our order with Razorpay order ID
        updateOrderRazorpayId(order.id, razorpayResult.order.id)

        return Response.json({
          success: true,
          order: {
            ...order,
            razorpayOrderId: razorpayResult.order.id,
          },
          razorpay: {
            orderId: razorpayResult.order.id,
            amount: razorpayResult.order.amount,
            currency: razorpayResult.order.currency,
            keyId: getKeyId(),
          },
          hasExistingSubscription,
        })
      } catch (error) {
        log("ERROR", "Failed to create order", error)
        return Response.json({ error: "Failed to create order" }, { status: 500 })
      }
    }),
  },

  // Verify payment and complete order
  "/api/orders/verify": {
    POST: withAuth(async (req, user) => {
      try {
        const text = await req.text()
        const body = text ? JSON.parse(text) : {}

        const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body

        console.log(`[VERIFY] Payment verification request - orderId: ${orderId}, razorpay_order_id: ${razorpay_order_id}`)
        log("INFO", "Payment verification request", {
          orderId,
          razorpay_order_id,
          razorpay_payment_id,
          hasSignature: !!razorpay_signature,
        })

        if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
          log("ERROR", "Missing payment verification fields", {
            hasOrderId: !!orderId,
            hasRazorpayOrderId: !!razorpay_order_id,
            hasPaymentId: !!razorpay_payment_id,
            hasSignature: !!razorpay_signature,
          })
          return Response.json(
            { error: "Missing required payment verification fields" },
            { status: 400 }
          )
        }

        // Verify the payment signature
        const isValid = verifyPaymentSignature(
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature
        )

        console.log(`[VERIFY] Signature verification result - isValid: ${isValid}`)
        log("INFO", "Signature verification result", { orderId, razorpay_order_id, isValid })

        if (!isValid) {
          console.log(`[VERIFY] ERROR: Invalid payment signature`)
          log("WARN", "Invalid payment signature", { orderId, razorpay_order_id, razorpay_payment_id })
          return Response.json({ error: "Invalid payment signature" }, { status: 400 })
        }

        // Get the order and verify ownership
        const orderResult = getOrderById(orderId, user.id)

        if ("error" in orderResult) {
          return Response.json({ error: orderResult.error }, { status: 404 })
        }

        if (orderResult.order.status !== "pending") {
          return Response.json(
            { error: "Order already processed" },
            { status: 400 }
          )
        }

        // Mark order as paid
        const paidResult = markOrderPaid(orderId, razorpay_payment_id)

        if ("error" in paidResult) {
          return Response.json({ error: paidResult.error }, { status: 500 })
        }

        // Check if this is the first paid order (needs subscription creation)
        const isFirst = isFirstPaidOrder(user.id, orderId)
        let subscriptionData = null

        if (isFirst) {
          // Create or get Razorpay customer
          let customerId = getRazorpayCustomerId(user.id)

          if (!customerId) {
            const customerResult = await createCustomer(
              user.name || user.email,
              user.email,
              orderResult.order.shipping.phone,
              { user_id: String(user.id) }
            )

            if ("error" in customerResult) {
              log("ERROR", "Failed to create Razorpay customer", customerResult.error)
              // Don't fail the order, but log the error
            } else {
              customerId = customerResult.customer.id
              updateRazorpayCustomerId(user.id, customerId)
            }
          }

          // Create subscription if we have a customer
          if (customerId) {
            const subscriptionResult = await createSubscription(customerId, undefined, undefined, {
              user_id: String(user.id),
              order_id: String(orderId),
            })

            if ("error" in subscriptionResult) {
              log("ERROR", "Failed to create subscription", subscriptionResult.error)
              // Don't fail the order, subscription can be created later
            } else {
              const sub = subscriptionResult.subscription
              // Convert Unix timestamp to ISO string
              const periodEnd = sub.current_end
                ? new Date(sub.current_end * 1000).toISOString()
                : null

              activateSubscription(user.id, sub.id, periodEnd ?? undefined)
              setFirstOrderId(user.id, orderId)

              subscriptionData = {
                id: sub.id,
                status: sub.status,
                currentPeriodEnd: periodEnd,
              }
            }
          }
        }

        // Set first order ID if not already set
        if (!isFirst) {
          setFirstOrderId(user.id, orderId)
        }

        log("INFO", "Payment verified and order completed", {
          orderId,
          userId: user.id,
          isFirstOrder: isFirst,
        })

        return Response.json({
          success: true,
          order: paidResult.order,
          subscription: subscriptionData,
          isFirstOrder: isFirst,
        })
      } catch (error) {
        log("ERROR", "Payment verification failed", error)
        return Response.json(
          { error: "Payment verification failed" },
          { status: 500 }
        )
      }
    }),
  },

  // Get a specific order
  "/api/orders/:id": {
    GET: withAuth(async (req, user) => {
      try {
        // Extract order ID from URL
        const url = new URL(req.url)
        const pathParts = url.pathname.split("/")
        const orderIdStr = pathParts[pathParts.length - 1] || ""
        const orderId = parseInt(orderIdStr, 10)

        if (isNaN(orderId)) {
          return Response.json({ error: "Invalid order ID" }, { status: 400 })
        }

        const result = getOrderById(orderId, user.id)

        if ("error" in result) {
          return Response.json({ error: result.error }, { status: 404 })
        }

        return Response.json({
          success: true,
          order: result.order,
        })
      } catch (error) {
        log("ERROR", "Failed to get order", error)
        return Response.json({ error: "Failed to get order" }, { status: 500 })
      }
    }),
  },

  // Check purchase status (for frontend routing)
  "/api/orders/status": {
    GET: withAuth(async (req, user) => {
      try {
        const hasPurchased = hasCompletedOrder(user.id)
        const subResult = getSubscriptionStatus(user.id)

        if ("error" in subResult) {
          return Response.json({ error: subResult.error }, { status: 500 })
        }

        return Response.json({
          success: true,
          hasCompletedOrder: hasPurchased,
          subscription: subResult.subscription,
        })
      } catch (error) {
        log("ERROR", "Failed to get order status", error)
        return Response.json({ error: "Failed to get order status" }, { status: 500 })
      }
    }),
  },
}
