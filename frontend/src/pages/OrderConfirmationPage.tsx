import { useState, useEffect } from "react"
import {
  CheckCircle,
  Package,
  Gift,
  MapPin,
  Loader2,
  ShoppingBag,
  Sparkles,
  ArrowRight,
} from "lucide-react"
import { Button } from "../components/ui/button"
import { cn } from "../lib/utils"
import { type Order } from "../hooks"

interface OrderConfirmationPageProps {
  orderId: number
  authHeaders: { Authorization?: string }
  onViewOrders: () => void
  onStartCreating: () => void
  isFirstOrder?: boolean
}

export function OrderConfirmationPage({
  orderId,
  authHeaders,
  onViewOrders,
  onStartCreating,
  isFirstOrder = false,
}: OrderConfirmationPageProps) {
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        // Use authHeaders prop directly to ensure token is passed
        const response = await fetch(`/api/orders/${orderId}`, {
          headers: {
            ...authHeaders,
          },
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setOrder(data.order)
        } else {
          setError(data.error || "Failed to load order")
        }
      } catch (err) {
        setError("Failed to load order")
      }
      setIsLoading(false)
    }

    fetchOrder()
  }, [orderId, authHeaders])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Order not found"}</p>
          <Button onClick={onViewOrders} variant="outline">
            View My Orders
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative">
        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          {/* Success Icon */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/25 animate-in zoom-in duration-500">
              <CheckCircle className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
              Order Confirmed!
            </h1>
            <p className="text-slate-400 text-sm mt-1 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
              Order #{order.orderNumber}
            </p>
          </div>

          {/* Order Details Card */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
            {/* Items */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
                  <Package className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <p className="text-white font-medium">
                    {order.quantity}x TRMNL Photo Frame
                  </p>
                  <p className="text-slate-500 text-sm">
                    ${(order.unitPrice / 100).toFixed(2)} each
                  </p>
                </div>
              </div>
              <p className="text-white font-bold">
                ${(order.totalAmount / 100).toFixed(2)}
              </p>
            </div>

            {/* Shipping Address */}
            <div className="pt-4">
              <p className="text-slate-400 text-sm mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Shipping to
              </p>
              <p className="text-white">{order.shipping.name}</p>
              <p className="text-slate-400 text-sm">
                {order.shipping.addressLine1}
                {order.shipping.addressLine2 && <>, {order.shipping.addressLine2}</>}
              </p>
              <p className="text-slate-400 text-sm">
                {order.shipping.city}, {order.shipping.state} {order.shipping.postalCode}
              </p>
              <p className="text-slate-400 text-sm">{order.shipping.country}</p>
            </div>

            {/* Gift info (if applicable) */}
            {order.isGift && (
              <div className="pt-4 mt-4 border-t border-slate-700">
                <p className="text-slate-400 text-sm mb-2 flex items-center gap-2">
                  <Gift className="h-4 w-4 text-pink-400" />
                  Gift for
                </p>
                <p className="text-white">{order.giftRecipientName}</p>
                {order.giftMessage && (
                  <p className="text-slate-400 text-sm italic mt-1">
                    "{order.giftMessage}"
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Subscription notice (first order) */}
          {isFirstOrder && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-emerald-400 font-medium">Subscription Activated!</p>
                  <p className="text-emerald-400/80 text-sm mt-1">
                    Your $5.99/month subscription is now active. Start creating AI-powered
                    images for your TRMNL display!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info message */}
          <p className="text-slate-400 text-sm text-center mb-6 animate-in fade-in duration-500 delay-500">
            We'll send you an email with tracking information once your order ships.
          </p>

          {/* Action buttons */}
          <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
            <Button
              onClick={onViewOrders}
              variant="outline"
              className="flex-1 py-3 rounded-xl border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              View Orders
            </Button>
            <Button
              onClick={onStartCreating}
              className={cn(
                "flex-1 py-3 rounded-xl font-semibold text-white transition-all duration-300",
                "bg-gradient-to-r from-teal-500 to-emerald-500",
                "hover:from-teal-400 hover:to-emerald-400",
                "shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
              )}
            >
              Start Creating
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          Thank you for your purchase!
        </p>
      </div>
    </div>
  )
}
