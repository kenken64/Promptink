import { useState } from "react"
import {
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  PauseCircle,
  Calendar,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { Button } from "../components/ui/button"
import { cn } from "../lib/utils"
import { useSubscription, useLanguage, type SubscriptionStatus } from "../hooks"

interface SubscriptionPageProps {
  authHeaders: { Authorization?: string }
  onBack: () => void
}

const statusIcons: Record<SubscriptionStatus, typeof CheckCircle> = {
  none: XCircle,
  active: CheckCircle,
  paused: PauseCircle,
  cancelled: XCircle,
  past_due: AlertCircle,
}

const statusColors: Record<SubscriptionStatus, { color: string; bgColor: string }> = {
  none: { color: "text-slate-400", bgColor: "bg-slate-400/10" },
  active: { color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  paused: { color: "text-yellow-400", bgColor: "bg-yellow-400/10" },
  cancelled: { color: "text-red-400", bgColor: "bg-red-400/10" },
  past_due: { color: "text-orange-400", bgColor: "bg-orange-400/10" },
}

export function SubscriptionPage({ authHeaders, onBack }: SubscriptionPageProps) {
  const { t, language } = useLanguage()
  const {
    subscription,
    isLoading,
    error,
    cancelSubscription,
    reactivateSubscription,
    createDirectSubscription,
    fetchStatus,
  } = useSubscription()

  const [isCancelling, setIsCancelling] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    setMessage(null)

    const result = await cancelSubscription()

    if (result.success) {
      setMessage({
        type: "success",
        text: t.subscription.cancelSuccess,
      })
    } else {
      setMessage({
        type: "error",
        text: result.error || t.subscription.cancelError,
      })
    }

    setIsCancelling(false)
    setShowCancelConfirm(false)
  }

  const handleReactivate = async () => {
    setIsReactivating(true)
    setMessage(null)

    const result = await reactivateSubscription()

    if (result.success && result.data) {
      // Redirect to Razorpay subscription page
      window.location.href = result.data.subscription.shortUrl
    } else {
      setMessage({
        type: "error",
        text: result.error || t.subscription.reactivateError,
      })
      setIsReactivating(false)
    }
  }

  const handleSubscribe = async () => {
    setIsSubscribing(true)
    setMessage(null)

    const result = await createDirectSubscription()

    if (result.success && result.data) {
      // Redirect to Razorpay subscription page
      window.location.href = result.data.subscription.shortUrl
    } else {
      setMessage({
        type: "error",
        text: result.error || t.subscription.subscribeError,
      })
      setIsSubscribing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    )
  }

  const currentStatus = subscription?.status || "none"
  const StatusIcon = statusIcons[currentStatus]
  const colors = statusColors[currentStatus]
  const statusText = t.subscription.status[currentStatus]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative max-w-lg mx-auto p-4 pt-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-teal-400" />
              {t.subscription.title}
            </h1>
            <p className="text-slate-400 text-sm">{t.subscription.subtitle}</p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={cn(
              "mb-6 p-4 rounded-xl text-sm animate-in fade-in slide-in-from-top-2 duration-300",
              message.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            )}
          >
            {message.text}
          </div>
        )}

        {/* Subscription Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
          {/* Status Header */}
          <div className={cn("p-6", colors.bgColor)}>
            <div className="flex items-center gap-3">
              <StatusIcon className={cn("h-8 w-8", colors.color)} />
              <div>
                <h2 className={cn("text-xl font-bold", colors.color)}>{statusText.label}</h2>
                <p className="text-slate-400 text-sm mt-1">{statusText.description}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-6">
            {/* Plan info */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">{t.subscription.plan}</p>
                <p className="text-white font-medium">{t.subscription.planName}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm">{t.subscription.price}</p>
                <p className="text-white font-bold">{t.subscription.priceValue}</p>
              </div>
            </div>

            {/* Next billing date */}
            {subscription?.status === "active" && subscription.currentPeriodEnd && (
              <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-xl">
                <Calendar className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-slate-400 text-sm">{t.subscription.nextBillingDate}</p>
                  <p className="text-white font-medium">
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                </div>
              </div>
            )}

            {/* Order count */}
            {subscription && (
              <div className="text-slate-400 text-sm">
                {t.subscription.totalOrders} {subscription.totalOrdersCount}
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-slate-700">
              {subscription?.status === "active" && (
                <>
                  {showCancelConfirm ? (
                    <div className="space-y-3">
                      <p className="text-slate-300 text-sm">
                        {t.subscription.cancelConfirm}
                      </p>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => setShowCancelConfirm(false)}
                          variant="outline"
                          className="flex-1 border-slate-700"
                          disabled={isCancelling}
                        >
                          {t.subscription.keepSubscription}
                        </Button>
                        <Button
                          onClick={handleCancel}
                          variant="destructive"
                          className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                          disabled={isCancelling}
                        >
                          {isCancelling ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          {t.subscription.yesCancel}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setShowCancelConfirm(true)}
                      variant="outline"
                      className="w-full border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                    >
                      {t.subscription.cancelSubscription}
                    </Button>
                  )}
                </>
              )}

              {(subscription?.status === "cancelled" ||
                subscription?.status === "past_due") && (
                <Button
                  onClick={handleReactivate}
                  disabled={isReactivating}
                  className={cn(
                    "w-full py-3 rounded-xl font-semibold text-white transition-all duration-300",
                    "bg-gradient-to-r from-teal-500 to-emerald-500",
                    "hover:from-teal-400 hover:to-emerald-400",
                    "shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
                  )}
                >
                  {isReactivating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t.subscription.processing}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t.subscription.reactivate}
                    </>
                  )}
                </Button>
              )}

              {subscription?.status === "none" && (
                <div className="space-y-3">
                  <p className="text-center text-slate-400 text-sm">
                    {t.subscription.alreadyOwnDevice}
                  </p>
                  <Button
                    onClick={handleSubscribe}
                    disabled={isSubscribing}
                    className={cn(
                      "w-full py-3 rounded-xl font-semibold text-white transition-all duration-300",
                      "bg-gradient-to-r from-teal-500 to-emerald-500",
                      "hover:from-teal-400 hover:to-emerald-400",
                      "shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
                    )}
                  >
                    {isSubscribing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {t.subscription.processing}
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        {t.subscription.subscribeNow}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Help text */}
        <p className="text-center text-slate-500 text-xs mt-6">
          {t.subscription.helpText}
        </p>
      </div>
    </div>
  )
}
