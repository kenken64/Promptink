import { log } from "../utils"
import * as crypto from "crypto"

// Environment variables
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || ""
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || ""
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || ""
const RAZORPAY_PLAN_ID = process.env.RAZORPAY_PLAN_ID || ""

// Log configuration status
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.warn("[RAZORPAY] WARNING: Razorpay credentials not configured")
} else {
  console.log("[RAZORPAY] Razorpay credentials configured")
}

// Base URL for Razorpay API
const RAZORPAY_API_URL = "https://api.razorpay.com/v1"

// Auth header for Razorpay API
function getAuthHeader(): string {
  return "Basic " + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")
}

// Generic API request helper
async function razorpayRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${RAZORPAY_API_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }))
    log("ERROR", "Razorpay API error", { endpoint, status: response.status, error })
    throw new Error(`Razorpay API error: ${JSON.stringify(error)}`)
  }

  return response.json() as Promise<T>
}

// Types
export interface RazorpayOrder {
  id: string
  entity: string
  amount: number
  amount_paid: number
  amount_due: number
  currency: string
  receipt: string
  status: "created" | "attempted" | "paid"
  notes: Record<string, string>
  created_at: number
}

export interface RazorpayCustomer {
  id: string
  entity: string
  name: string
  email: string
  contact: string
  gstin: string | null
  notes: Record<string, string>
  created_at: number
}

export interface RazorpaySubscription {
  id: string
  entity: string
  plan_id: string
  customer_id: string
  status:
    | "created"
    | "authenticated"
    | "active"
    | "pending"
    | "halted"
    | "cancelled"
    | "completed"
    | "expired"
    | "paused"
  current_start: number
  current_end: number
  ended_at: number | null
  quantity: number
  notes: Record<string, string>
  charge_at: number
  short_url: string
  has_scheduled_changes: boolean
  change_scheduled_at: number | null
  source: string
  payment_method: string
  created_at: number
}

export interface RazorpayPayment {
  id: string
  entity: string
  amount: number
  currency: string
  status: "created" | "authorized" | "captured" | "refunded" | "failed"
  order_id: string
  method: string
  description: string
  bank: string | null
  wallet: string | null
  vpa: string | null
  email: string
  contact: string
  notes: Record<string, string>
  fee: number
  tax: number
  error_code: string | null
  error_description: string | null
  created_at: number
}

// Create a Razorpay order (for one-time payment)
export async function createRazorpayOrder(
  amount: number,
  currency: string,
  receipt: string,
  notes?: Record<string, string>
): Promise<{ order: RazorpayOrder } | { error: string }> {
  try {
    const order = await razorpayRequest<RazorpayOrder>("/orders", "POST", {
      amount,
      currency,
      receipt,
      notes: notes || {},
    })

    log("INFO", "Razorpay order created", { orderId: order.id, amount, currency })
    return { order }
  } catch (error) {
    log("ERROR", "Failed to create Razorpay order", error)
    return { error: "Failed to create payment order" }
  }
}

// Get order details
export async function getRazorpayOrder(
  orderId: string
): Promise<{ order: RazorpayOrder } | { error: string }> {
  try {
    const order = await razorpayRequest<RazorpayOrder>(`/orders/${orderId}`)
    return { order }
  } catch (error) {
    log("ERROR", "Failed to get Razorpay order", error)
    return { error: "Failed to get order details" }
  }
}

// Verify payment signature
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  try {
    const body = `${orderId}|${paymentId}`
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex")

    const isValid = expectedSignature === signature
    log("DEBUG", "Payment signature verification", { orderId, paymentId, isValid })
    return isValid
  } catch (error) {
    log("ERROR", "Failed to verify payment signature", error)
    return false
  }
}

// Create or get customer
export async function createCustomer(
  name: string,
  email: string,
  contact?: string,
  notes?: Record<string, string>
): Promise<{ customer: RazorpayCustomer } | { error: string }> {
  try {
    const customer = await razorpayRequest<RazorpayCustomer>("/customers", "POST", {
      name,
      email,
      contact: contact || "",
      notes: notes || {},
    })

    log("INFO", "Razorpay customer created", { customerId: customer.id, email })
    return { customer }
  } catch (error) {
    log("ERROR", "Failed to create Razorpay customer", error)
    return { error: "Failed to create customer" }
  }
}

// Get customer details
export async function getCustomer(
  customerId: string
): Promise<{ customer: RazorpayCustomer } | { error: string }> {
  try {
    const customer = await razorpayRequest<RazorpayCustomer>(`/customers/${customerId}`)
    return { customer }
  } catch (error) {
    log("ERROR", "Failed to get Razorpay customer", error)
    return { error: "Failed to get customer details" }
  }
}

// Create subscription
export async function createSubscription(
  customerId: string,
  planId?: string,
  totalCount?: number,
  notes?: Record<string, string>
): Promise<{ subscription: RazorpaySubscription } | { error: string }> {
  try {
    const subscription = await razorpayRequest<RazorpaySubscription>("/subscriptions", "POST", {
      plan_id: planId || RAZORPAY_PLAN_ID,
      customer_id: customerId,
      total_count: totalCount || 120, // 120 = 10 years of monthly billing
      notes: notes || {},
    })

    log("INFO", "Razorpay subscription created", {
      subscriptionId: subscription.id,
      customerId,
      planId: planId || RAZORPAY_PLAN_ID,
    })
    return { subscription }
  } catch (error) {
    log("ERROR", "Failed to create Razorpay subscription", error)
    return { error: "Failed to create subscription" }
  }
}

// Get subscription details
export async function getSubscription(
  subscriptionId: string
): Promise<{ subscription: RazorpaySubscription } | { error: string }> {
  try {
    const subscription = await razorpayRequest<RazorpaySubscription>(
      `/subscriptions/${subscriptionId}`
    )
    return { subscription }
  } catch (error) {
    log("ERROR", "Failed to get Razorpay subscription", error)
    return { error: "Failed to get subscription details" }
  }
}

// Cancel subscription
export async function cancelRazorpaySubscription(
  subscriptionId: string,
  cancelAtCycleEnd: boolean = false
): Promise<{ subscription: RazorpaySubscription } | { error: string }> {
  try {
    const subscription = await razorpayRequest<RazorpaySubscription>(
      `/subscriptions/${subscriptionId}/cancel`,
      "POST",
      { cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }
    )

    log("INFO", "Razorpay subscription cancelled", { subscriptionId, cancelAtCycleEnd })
    return { subscription }
  } catch (error) {
    log("ERROR", "Failed to cancel Razorpay subscription", error)
    return { error: "Failed to cancel subscription" }
  }
}

// Pause subscription
export async function pauseRazorpaySubscription(
  subscriptionId: string
): Promise<{ subscription: RazorpaySubscription } | { error: string }> {
  try {
    const subscription = await razorpayRequest<RazorpaySubscription>(
      `/subscriptions/${subscriptionId}/pause`,
      "POST",
      { pause_initiated_by: "customer" }
    )

    log("INFO", "Razorpay subscription paused", { subscriptionId })
    return { subscription }
  } catch (error) {
    log("ERROR", "Failed to pause Razorpay subscription", error)
    return { error: "Failed to pause subscription" }
  }
}

// Resume subscription
export async function resumeSubscription(
  subscriptionId: string
): Promise<{ subscription: RazorpaySubscription } | { error: string }> {
  try {
    const subscription = await razorpayRequest<RazorpaySubscription>(
      `/subscriptions/${subscriptionId}/resume`,
      "POST",
      { resume_initiated_by: "customer" }
    )

    log("INFO", "Razorpay subscription resumed", { subscriptionId })
    return { subscription }
  } catch (error) {
    log("ERROR", "Failed to resume Razorpay subscription", error)
    return { error: "Failed to resume subscription" }
  }
}

// Get payment details
export async function getPayment(
  paymentId: string
): Promise<{ payment: RazorpayPayment } | { error: string }> {
  try {
    const payment = await razorpayRequest<RazorpayPayment>(`/payments/${paymentId}`)
    return { payment }
  } catch (error) {
    log("ERROR", "Failed to get Razorpay payment", error)
    return { error: "Failed to get payment details" }
  }
}

// Verify webhook signature
export function verifyWebhookSignature(body: string, signature: string): boolean {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex")

    const isValid = expectedSignature === signature
    log("DEBUG", "Webhook signature verification", { isValid })
    return isValid
  } catch (error) {
    log("ERROR", "Failed to verify webhook signature", error)
    return false
  }
}

// Webhook event types
export type RazorpayWebhookEvent =
  | "payment.captured"
  | "payment.failed"
  | "subscription.activated"
  | "subscription.charged"
  | "subscription.completed"
  | "subscription.cancelled"
  | "subscription.paused"
  | "subscription.resumed"
  | "subscription.pending"
  | "subscription.halted"

// Webhook payload interface
export interface RazorpayWebhookPayload {
  entity: string
  account_id: string
  event: RazorpayWebhookEvent
  contains: string[]
  payload: {
    payment?: { entity: RazorpayPayment }
    subscription?: { entity: RazorpaySubscription }
    order?: { entity: RazorpayOrder }
  }
  created_at: number
}

// Get Razorpay key ID (for frontend)
export function getKeyId(): string {
  return RAZORPAY_KEY_ID
}

// Check if Razorpay is configured
export function isConfigured(): boolean {
  return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET)
}

// Get plan ID
export function getPlanId(): string {
  return RAZORPAY_PLAN_ID
}
