import { useState, FormEvent } from "react"
import {
  ShoppingCart,
  Package,
  Gift,
  MapPin,
  Phone,
  Mail,
  User,
  Minus,
  Plus,
  Loader2,
  CreditCard,
  Check,
} from "lucide-react"
import { Button } from "../components/ui/button"
import { cn } from "../lib/utils"
import { useOrders, useSubscription, useLanguage, type CreateOrderInput } from "../hooks"
import photoFrameImage from "../assets/1000091170.png"

interface PurchasePageProps {
  authHeaders: { Authorization?: string }
  onSuccess: (orderId: number, isFirstOrder: boolean) => void
  onBack?: () => void
  onSkip?: () => void
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance
  }
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (response: RazorpayResponse) => void
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  theme?: {
    color?: string
  }
  modal?: {
    ondismiss?: () => void
  }
}

interface RazorpayInstance {
  open: () => void
  close: () => void
}

interface RazorpayResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

const UNIT_PRICE = 120 // $120
const SUBSCRIPTION_FEE = 5.99 // $5.99/month base
const GST_RATE = 0.09 // Singapore GST 9%
const SUBSCRIPTION_GST = SUBSCRIPTION_FEE * GST_RATE
const SUBSCRIPTION_WITH_GST = SUBSCRIPTION_FEE + SUBSCRIPTION_GST

export function PurchasePage({ authHeaders, onSuccess, onBack, onSkip }: PurchasePageProps) {
  const { createOrder, verifyPayment } = useOrders()
  const { subscription } = useSubscription()
  const { t } = useLanguage()

  const [quantity, setQuantity] = useState(1)
  const [isGift, setIsGift] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shipping form state
  const [shipping, setShipping] = useState({
    name: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  })

  // Gift form state
  const [gift, setGift] = useState({
    recipientName: "",
    message: "",
  })

  const hasExistingSubscription = subscription?.status === "active"
  const subtotal = quantity * UNIT_PRICE
  const frameGst = subtotal * GST_RATE
  const subscriptionTotal = hasExistingSubscription ? 0 : SUBSCRIPTION_WITH_GST
  const totalAmount = subtotal + frameGst + subscriptionTotal

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(10, prev + delta)))
  }

  const handleShippingChange = (field: string, value: string) => {
    setShipping((prev) => ({ ...prev, [field]: value }))
  }

  const handleGiftChange = (field: string, value: string) => {
    setGift((prev) => ({ ...prev, [field]: value }))
  }

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true)
        return
      }

      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Validate form
      if (!shipping.name.trim()) {
        throw new Error(t.purchase.errors.fullName)
      }
      if (!shipping.phone.trim()) {
        throw new Error(t.purchase.errors.phone)
      }
      if (!shipping.addressLine1.trim()) {
        throw new Error(t.purchase.errors.address)
      }
      if (!shipping.city.trim()) {
        throw new Error(t.purchase.errors.city)
      }
      if (!shipping.state.trim()) {
        throw new Error(t.purchase.errors.state)
      }
      if (!shipping.postalCode.trim()) {
        throw new Error(t.purchase.errors.postalCode)
      }
      if (!shipping.country.trim()) {
        throw new Error(t.purchase.errors.country)
      }
      if (isGift && !gift.recipientName.trim()) {
        throw new Error(t.purchase.errors.giftRecipient)
      }

      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        throw new Error(t.purchase.errors.paymentLoad)
      }

      // Create order
      const orderInput: CreateOrderInput = {
        quantity,
        shipping: {
          name: shipping.name.trim(),
          email: shipping.email.trim() || undefined,
          phone: shipping.phone.trim(),
          addressLine1: shipping.addressLine1.trim(),
          addressLine2: shipping.addressLine2.trim() || undefined,
          city: shipping.city.trim(),
          state: shipping.state.trim(),
          postalCode: shipping.postalCode.trim(),
          country: shipping.country.trim(),
        },
        gift: isGift
          ? {
              isGift: true,
              recipientName: gift.recipientName.trim(),
              message: gift.message.trim() || undefined,
            }
          : undefined,
      }

      const orderResult = await createOrder(orderInput)

      console.log("[Payment] Order creation result:", orderResult)

      if (!orderResult.success || !orderResult.data) {
        throw new Error(orderResult.error || t.purchase.errors.orderCreate)
      }

      const { order, razorpay } = orderResult.data

      console.log("[Payment] Opening Razorpay checkout:", {
        orderId: order.id,
        razorpayOrderId: razorpay.orderId,
        amount: razorpay.amount,
        currency: razorpay.currency,
      })

      // Open Razorpay checkout
      const options: RazorpayOptions = {
        key: razorpay.keyId,
        amount: razorpay.amount,
        currency: razorpay.currency,
        name: "PromptInk",
        description: `TRMNL Photo Frame x${quantity}`,
        order_id: razorpay.orderId,
        handler: async (response: RazorpayResponse) => {
          console.log("[Payment] Razorpay response received:", {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            hasSignature: !!response.razorpay_signature,
          })

          // Verify payment
          try {
            const verifyResult = await verifyPayment({
              orderId: order.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })

            console.log("[Payment] Verification result:", verifyResult)

            if (!verifyResult.success) {
              console.error("[Payment] Verification failed:", verifyResult.error)
              setError(verifyResult.error || t.purchase.errors.paymentVerify)
              setIsLoading(false)
              return
            }

            // Success - redirect to confirmation
            console.log("[Payment] Verification successful, redirecting...")
            onSuccess(order.id, verifyResult.data?.isFirstOrder ?? false)
          } catch (verifyError) {
            console.error("[Payment] Verification exception:", verifyError)
            setError(t.purchase.errors.paymentVerify)
            setIsLoading(false)
          }
        },
        prefill: {
          name: shipping.name,
          email: shipping.email,
          contact: shipping.phone,
        },
        theme: {
          color: "#14b8a6",
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false)
          },
        },
      }

      const razorpayInstance = new window.Razorpay(options)
      razorpayInstance.open()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.purchase.errors.general)
      setIsLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-y-auto scroll-touch bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 py-4 sm:py-8 px-4 flex justify-center">
        <div className="w-full max-w-lg relative">
        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-full max-w-xs mb-4 rounded-xl overflow-hidden shadow-lg shadow-teal-500/25">
              <img
                src={photoFrameImage}
                alt={t.purchase.title}
                className="w-full h-auto object-cover"
              />
            </div>
            <h1 className="text-2xl font-bold text-white">{t.purchase.title}</h1>
            <p className="text-slate-400 text-sm mt-1">{t.purchase.subtitle}</p>
          </div>

          {/* Price and Quantity */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-300 font-medium">{t.purchase.pricePerFrame}</span>
              <span className="text-xl font-bold text-white">${UNIT_PRICE}.00</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">{t.purchase.quantity}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-xl font-bold text-white w-8 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= 10}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 rounded-lg text-sm text-center bg-red-500/10 border border-red-500/20 text-red-400 animate-in fade-in slide-in-from-top-2 duration-300">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Gift toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsGift(!isGift)}
                className={cn(
                  "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                  isGift
                    ? "bg-teal-500 border-teal-500"
                    : "bg-transparent border-slate-600 hover:border-slate-500"
                )}
              >
                {isGift && <Check className="h-4 w-4 text-white" />}
              </button>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer" onClick={() => setIsGift(!isGift)}>
                <Gift className="h-4 w-4" />
                {t.purchase.thisIsGift}
              </label>
            </div>

            {/* Shipping Address Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t.purchase.shippingAddress}
              </h3>

              {/* Full Name */}
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type="text"
                  value={shipping.name}
                  onChange={(e) => handleShippingChange("name", e.target.value)}
                  placeholder={t.purchase.fullName}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>

              {/* Email */}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type="email"
                  value={shipping.email}
                  onChange={(e) => handleShippingChange("email", e.target.value)}
                  placeholder={t.purchase.email}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>

              {/* Phone */}
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type="tel"
                  value={shipping.phone}
                  onChange={(e) => handleShippingChange("phone", e.target.value)}
                  placeholder={t.purchase.phone}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>

              {/* Address Line 1 */}
              <input
                type="text"
                value={shipping.addressLine1}
                onChange={(e) => handleShippingChange("addressLine1", e.target.value)}
                placeholder={t.purchase.addressLine1}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
              />

              {/* Address Line 2 */}
              <input
                type="text"
                value={shipping.addressLine2}
                onChange={(e) => handleShippingChange("addressLine2", e.target.value)}
                placeholder={t.purchase.addressLine2}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
              />

              {/* City & State */}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={shipping.city}
                  onChange={(e) => handleShippingChange("city", e.target.value)}
                  placeholder={t.purchase.city}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
                <input
                  type="text"
                  value={shipping.state}
                  onChange={(e) => handleShippingChange("state", e.target.value)}
                  placeholder={t.purchase.state}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>

              {/* Postal Code & Country */}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={shipping.postalCode}
                  onChange={(e) => handleShippingChange("postalCode", e.target.value)}
                  placeholder={t.purchase.postalCode}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
                <input
                  type="text"
                  value={shipping.country}
                  onChange={(e) => handleShippingChange("country", e.target.value)}
                  placeholder={t.purchase.country}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>
            </div>

            {/* Gift Section (conditional) */}
            {isGift && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  {t.purchase.giftDetails}
                </h3>

                <input
                  type="text"
                  value={gift.recipientName}
                  onChange={(e) => handleGiftChange("recipientName", e.target.value)}
                  placeholder={t.purchase.recipientName}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />

                <textarea
                  value={gift.message}
                  onChange={(e) => handleGiftChange("message", e.target.value)}
                  placeholder={t.purchase.giftMessage}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all resize-none"
                />
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-slate-700 pt-4">
              {/* Order Summary */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-slate-400">
                  <span>{t.purchase.subtotal} ({quantity} {quantity > 1 ? t.purchase.frames : t.purchase.frame})</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>{t.purchase.gst}</span>
                  <span>${frameGst.toFixed(2)}</span>
                </div>
                {!hasExistingSubscription && (
                  <div className="flex justify-between text-slate-400">
                    <span>{t.purchase.monthlySubscription} ({t.purchase.inclGst})</span>
                    <span>${SUBSCRIPTION_WITH_GST.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-slate-700">
                  <span>{t.purchase.totalToday}</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
                {!hasExistingSubscription && (
                  <p className="text-slate-500 text-xs">
                    {t.purchase.subscriptionNote}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "w-full py-4 rounded-xl font-semibold text-white transition-all duration-300",
                  "bg-gradient-to-r from-teal-500 to-emerald-500",
                  "hover:from-teal-400 hover:to-emerald-400",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
                )}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {t.purchase.processing}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    {t.purchase.pay} ${totalAmount.toFixed(2)}
                  </span>
                )}
              </Button>

              {/* Skip button */}
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="w-full py-3 text-slate-400 hover:text-slate-300 text-sm transition-colors"
                >
                  {t.purchase.skipForNow}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          {t.purchase.securePayment}
        </p>
      </div>
      </div>
    </div>
  )
}
