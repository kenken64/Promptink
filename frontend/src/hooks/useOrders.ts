import { useState, useEffect, useCallback } from "react"
import { useAuth } from "./useAuth"

export interface OrderShipping {
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

export interface OrderTracking {
  number: string | null
  carrier: string | null
  url: string | null
}

export interface Order {
  id: number
  orderNumber: string
  quantity: number
  unitPrice: number
  totalAmount: number
  currency: string
  status: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled"
  shipping: OrderShipping
  isGift: boolean
  giftRecipientName: string | null
  giftMessage: string | null
  tracking: OrderTracking | null
  createdAt: string
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
}

export interface CreateOrderInput {
  quantity: number
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

export interface CreateOrderResponse {
  success: boolean
  order: Order & { razorpayOrderId: string }
  razorpay: {
    orderId: string
    amount: number
    currency: string
    keyId: string
  }
  hasExistingSubscription: boolean
}

export interface VerifyPaymentInput {
  orderId: number
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export interface VerifyPaymentResponse {
  success: boolean
  order: Order
  subscription: {
    id: string
    status: string
    currentPeriodEnd: string | null
  } | null
  isFirstOrder: boolean
}

interface OrdersState {
  orders: Order[]
  isLoading: boolean
  error: string | null
}

export function useOrders() {
  const { authFetch, isAuthenticated } = useAuth()
  const [state, setState] = useState<OrdersState>({
    orders: [],
    isLoading: false,
    error: null,
  })

  // Fetch all orders
  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated) return

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await authFetch("/api/orders")

      const data = await response.json()

      if (!response.ok || !data.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || "Failed to fetch orders",
        }))
        return
      }

      setState({
        orders: data.orders,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to fetch orders",
      }))
    }
  }, [isAuthenticated, authFetch])

  // Create a new order
  const createOrder = useCallback(
    async (
      input: CreateOrderInput
    ): Promise<{ success: boolean; data?: CreateOrderResponse; error?: string }> => {
      try {
        const response = await authFetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          return { success: false, error: data.error || "Failed to create order" }
        }

        return { success: true, data }
      } catch (error) {
        return { success: false, error: "Failed to create order" }
      }
    },
    [authFetch]
  )

  // Verify payment
  const verifyPayment = useCallback(
    async (
      input: VerifyPaymentInput
    ): Promise<{ success: boolean; data?: VerifyPaymentResponse; error?: string }> => {
      try {
        const response = await authFetch("/api/orders/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          return { success: false, error: data.error || "Payment verification failed" }
        }

        // Refresh orders after successful payment
        fetchOrders()

        return { success: true, data }
      } catch (error) {
        return { success: false, error: "Payment verification failed" }
      }
    },
    [authFetch, fetchOrders]
  ) // Added fetchOrders to dependency as it is used inside

  // Get a single order
  const getOrder = useCallback(
    async (orderId: number): Promise<{ success: boolean; order?: Order; error?: string }> => {
      try {
        const response = await authFetch(`/api/orders/${orderId}`)

        const data = await response.json()

        if (!response.ok || !data.success) {
          return { success: false, error: data.error || "Failed to fetch order" }
        }

        return { success: true, order: data.order }
      } catch (error) {
        return { success: false, error: "Failed to fetch order" }
      }
    },
    [authFetch]
  )

  // Fetch orders on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders()
    }
  }, [isAuthenticated, fetchOrders])

  return {
    orders: state.orders,
    isLoading: state.isLoading,
    error: state.error,
    fetchOrders,
    createOrder,
    verifyPayment,
    getOrder,
  }
}
