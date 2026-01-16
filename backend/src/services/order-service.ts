import { db, orderQueries, userQueries, type Order } from "../db"
import { log } from "../utils"

// Constants
const UNIT_PRICE = 12000 // $120.00 in cents
const GST_RATE = 0.09 // Singapore GST 9%
const SUBSCRIPTION_FEE = 599 // $5.99 in cents
const SUBSCRIPTION_GST = Math.round(SUBSCRIPTION_FEE * GST_RATE) // GST on subscription
const SUBSCRIPTION_WITH_GST = SUBSCRIPTION_FEE + SUBSCRIPTION_GST // $6.53 in cents
const CURRENCY = "USD"

// Input types
export interface CreateOrderInput {
  userId: number
  quantity: number
  hasExistingSubscription?: boolean
  shipping: {
    name: string
    email?: string
    phone: string
    addressLine1: string
    addressLine2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  gift?: {
    isGift: boolean
    recipientName?: string
    message?: string
  }
}

export interface OrderResponse {
  id: number
  orderNumber: string
  quantity: number
  unitPrice: number
  totalAmount: number
  currency: string
  status: string
  shipping: {
    name: string
    email: string | null
    phone: string
    addressLine1: string
    addressLine2: string | null
    city: string
    state: string
    postalCode: string
    country: string
  }
  isGift: boolean
  giftRecipientName: string | null
  giftMessage: string | null
  tracking: {
    number: string | null
    carrier: string | null
    url: string | null
  } | null
  createdAt: string
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
}

// Generate unique order number
export function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${date}-${random}`
}

// Transform database order to response format
function transformOrder(order: Order): OrderResponse {
  return {
    id: order.id,
    orderNumber: order.order_number,
    quantity: order.quantity,
    unitPrice: order.unit_price,
    totalAmount: order.total_amount,
    currency: order.currency,
    status: order.status,
    shipping: {
      name: order.shipping_name,
      email: order.shipping_email,
      phone: order.shipping_phone,
      addressLine1: order.shipping_address_line1,
      addressLine2: order.shipping_address_line2,
      city: order.shipping_city,
      state: order.shipping_state,
      postalCode: order.shipping_postal_code,
      country: order.shipping_country,
    },
    isGift: Boolean(order.is_gift),
    giftRecipientName: order.gift_recipient_name,
    giftMessage: order.gift_message,
    tracking: order.tracking_number
      ? {
          number: order.tracking_number,
          carrier: order.carrier,
          url: order.tracking_url,
        }
      : null,
    createdAt: order.created_at,
    paidAt: order.paid_at,
    shippedAt: order.shipped_at,
    deliveredAt: order.delivered_at,
  }
}

// Create a new order
export function createOrder(
  input: CreateOrderInput
): { order: OrderResponse } | { error: string } {
  try {
    // Validate quantity
    if (input.quantity < 1) {
      return { error: "Quantity must be at least 1" }
    }
    if (input.quantity > 10) {
      return { error: "Maximum quantity is 10 per order" }
    }

    // Validate shipping
    if (!input.shipping.name?.trim()) {
      return { error: "Shipping name is required" }
    }
    if (!input.shipping.phone?.trim()) {
      return { error: "Shipping phone is required" }
    }
    if (!input.shipping.addressLine1?.trim()) {
      return { error: "Shipping address is required" }
    }
    if (!input.shipping.city?.trim()) {
      return { error: "Shipping city is required" }
    }
    if (!input.shipping.state?.trim()) {
      return { error: "Shipping state is required" }
    }
    if (!input.shipping.postalCode?.trim()) {
      return { error: "Shipping postal code is required" }
    }
    if (!input.shipping.country?.trim()) {
      return { error: "Shipping country is required" }
    }

    // Validate gift
    if (input.gift?.isGift && !input.gift.recipientName?.trim()) {
      return { error: "Gift recipient name is required when sending as gift" }
    }

    // Generate order number
    let orderNumber = generateOrderNumber()

    // Ensure uniqueness (retry if collision)
    let attempts = 0
    while (orderQueries.findByOrderNumber.get(orderNumber) && attempts < 5) {
      orderNumber = generateOrderNumber()
      attempts++
    }

    // Calculate total with GST
    const frameSubtotal = input.quantity * UNIT_PRICE
    const frameGst = Math.round(frameSubtotal * GST_RATE)
    const subscriptionTotal = input.hasExistingSubscription ? 0 : SUBSCRIPTION_WITH_GST
    const totalAmount = frameSubtotal + frameGst + subscriptionTotal

    // Create order
    const order = orderQueries.create.get(
      input.userId,
      orderNumber,
      input.quantity,
      UNIT_PRICE,
      totalAmount,
      CURRENCY,
      input.shipping.name.trim(),
      input.shipping.email?.trim() || null,
      input.shipping.phone.trim(),
      input.shipping.addressLine1.trim(),
      input.shipping.addressLine2?.trim() || null,
      input.shipping.city.trim(),
      input.shipping.state.trim(),
      input.shipping.postalCode.trim(),
      input.shipping.country.trim(),
      input.gift?.isGift ? 1 : 0,
      input.gift?.recipientName?.trim() || null,
      input.gift?.message?.trim() || null
    )

    if (!order) {
      return { error: "Failed to create order" }
    }

    log("INFO", "Order created", { orderId: order.id, orderNumber, userId: input.userId })

    return { order: transformOrder(order) }
  } catch (error) {
    log("ERROR", "Failed to create order", error)
    return { error: "Failed to create order" }
  }
}

// Get order by ID (with ownership check)
export function getOrderById(
  orderId: number,
  userId: number
): { order: OrderResponse } | { error: string } {
  try {
    const order = orderQueries.findByIdAndUserId.get(orderId, userId)
    if (!order) {
      return { error: "Order not found" }
    }
    return { order: transformOrder(order) }
  } catch (error) {
    log("ERROR", "Failed to get order", error)
    return { error: "Failed to get order" }
  }
}

// Get order by order number (admin use)
export function getOrderByOrderNumber(
  orderNumber: string
): { order: OrderResponse } | { error: string } {
  try {
    const order = orderQueries.findByOrderNumber.get(orderNumber)
    if (!order) {
      return { error: "Order not found" }
    }
    return { order: transformOrder(order) }
  } catch (error) {
    log("ERROR", "Failed to get order by order number", error)
    return { error: "Failed to get order" }
  }
}

// Get order by Razorpay order ID
export function getOrderByRazorpayOrderId(
  razorpayOrderId: string
): Order | null {
  try {
    return orderQueries.findByRazorpayOrderId.get(razorpayOrderId)
  } catch (error) {
    log("ERROR", "Failed to get order by Razorpay order ID", error)
    return null
  }
}

// Get all orders for a user
export function getOrdersByUserId(
  userId: number
): { orders: OrderResponse[] } | { error: string } {
  try {
    const orders = orderQueries.findAllByUserId.all(userId)
    return { orders: orders.map(transformOrder) }
  } catch (error) {
    log("ERROR", "Failed to get orders", error)
    return { error: "Failed to get orders" }
  }
}

// Check if user has any completed (paid) orders
export function hasCompletedOrder(userId: number): boolean {
  try {
    const result = orderQueries.countPaidByUserId.get(userId)
    return result ? result.count > 0 : false
  } catch (error) {
    log("ERROR", "Failed to check completed orders", error)
    return false
  }
}

// Get count of paid orders for user
export function getPaidOrderCount(userId: number): number {
  try {
    const result = orderQueries.countPaidByUserId.get(userId)
    return result?.count ?? 0
  } catch (error) {
    log("ERROR", "Failed to get paid order count", error)
    return 0
  }
}

// Update order with Razorpay order ID
export function updateOrderRazorpayId(
  orderId: number,
  razorpayOrderId: string
): boolean {
  try {
    orderQueries.updateRazorpayOrderId.run(razorpayOrderId, orderId)
    log("INFO", "Order updated with Razorpay ID", { orderId, razorpayOrderId })
    return true
  } catch (error) {
    log("ERROR", "Failed to update order Razorpay ID", error)
    return false
  }
}

// Mark order as paid
export function markOrderPaid(
  orderId: number,
  razorpayPaymentId: string
): { order: OrderResponse } | { error: string } {
  try {
    const order = orderQueries.findById.get(orderId)
    if (!order) {
      return { error: "Order not found" }
    }

    if (order.status !== "pending") {
      return { error: "Order already processed" }
    }

    orderQueries.updatePayment.run(razorpayPaymentId, orderId)

    // Fetch updated order
    const updatedOrder = orderQueries.findById.get(orderId)
    if (!updatedOrder) {
      return { error: "Failed to fetch updated order" }
    }

    log("INFO", "Order marked as paid", { orderId, razorpayPaymentId })
    return { order: transformOrder(updatedOrder) }
  } catch (error) {
    log("ERROR", "Failed to mark order as paid", error)
    return { error: "Failed to update order" }
  }
}

// Update order status
export function updateOrderStatus(
  orderId: number,
  status: Order["status"]
): { order: OrderResponse } | { error: string } {
  try {
    const order = orderQueries.findById.get(orderId)
    if (!order) {
      return { error: "Order not found" }
    }

    orderQueries.updateStatus.run(status, orderId)

    // Fetch updated order
    const updatedOrder = orderQueries.findById.get(orderId)
    if (!updatedOrder) {
      return { error: "Failed to fetch updated order" }
    }

    log("INFO", "Order status updated", { orderId, status })
    return { order: transformOrder(updatedOrder) }
  } catch (error) {
    log("ERROR", "Failed to update order status", error)
    return { error: "Failed to update order" }
  }
}

// Add tracking information
export function addOrderTracking(
  orderId: number,
  trackingNumber: string,
  carrier: string,
  trackingUrl?: string
): { order: OrderResponse } | { error: string } {
  try {
    const order = orderQueries.findById.get(orderId)
    if (!order) {
      return { error: "Order not found" }
    }

    orderQueries.updateTracking.run(trackingNumber, carrier, trackingUrl || null, orderId)

    // Fetch updated order
    const updatedOrder = orderQueries.findById.get(orderId)
    if (!updatedOrder) {
      return { error: "Failed to fetch updated order" }
    }

    log("INFO", "Order tracking added", { orderId, trackingNumber, carrier })
    return { order: transformOrder(updatedOrder) }
  } catch (error) {
    log("ERROR", "Failed to add order tracking", error)
    return { error: "Failed to update order" }
  }
}

// Check if this is the user's first paid order (for subscription creation)
export function isFirstPaidOrder(userId: number, excludeOrderId?: number): boolean {
  try {
    const paidOrders = orderQueries.findPaidByUserId.all(userId)
    if (excludeOrderId) {
      return paidOrders.filter(o => o.id !== excludeOrderId).length === 0
    }
    return paidOrders.length === 0
  } catch (error) {
    log("ERROR", "Failed to check first paid order", error)
    return false
  }
}
