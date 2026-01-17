import { useState } from "react"
import {
  Package,
  ShoppingBag,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Gift,
  ExternalLink,
  Plus,
  Loader2,
  MapPin,
} from "lucide-react"
import { Button } from "../components/ui/button"
import { PageHeader } from "../components/PageHeader"
import { cn } from "../lib/utils"
import { useOrders, useLanguage, type Order } from "../hooks"

type AppPage = "chat" | "gallery" | "schedule" | "batch" | "orders" | "subscription" | "settings"

interface OrdersPageProps {
  authHeaders: { Authorization?: string }
  onNavigate: (page: AppPage) => void
  onOrderMore: () => void
}

const statusIcons: Record<Order["status"], typeof Clock> = {
  pending: Clock,
  paid: CheckCircle,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
}

const statusColors: Record<Order["status"], { color: string; bgColor: string }> = {
  pending: { color: "text-yellow-400", bgColor: "bg-yellow-400/10" },
  paid: { color: "text-blue-400", bgColor: "bg-blue-400/10" },
  processing: { color: "text-purple-400", bgColor: "bg-purple-400/10" },
  shipped: { color: "text-teal-400", bgColor: "bg-teal-400/10" },
  delivered: { color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  cancelled: { color: "text-red-400", bgColor: "bg-red-400/10" },
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

interface OrderCardProps {
  order: Order
  t: ReturnType<typeof useLanguage>["t"]
  language: ReturnType<typeof useLanguage>["language"]
}

function OrderCard({ order, t, language }: OrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const StatusIcon = statusIcons[order.status]
  const colors = statusColors[order.status]
  const statusLabel = t.orders.status[order.status]

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-white font-medium">
                {language === "zh" ? `订单 #${order.orderNumber}` : `Order #${order.orderNumber}`}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1",
                  colors.bgColor,
                  colors.color
                )}
              >
                <StatusIcon className="h-3 w-3" />
                {statusLabel}
              </span>
              {order.isGift && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-400/10 text-pink-400 flex items-center gap-1">
                  <Gift className="h-3 w-3" />
                  {language === "zh" ? "礼物" : "Gift"}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm">
              {language === "zh" ? `下单于 ${formatDate(order.createdAt)}` : `Placed ${formatDate(order.createdAt)}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white font-bold">{formatPrice(order.totalAmount)}</p>
            <p className="text-slate-500 text-sm">
              {order.quantity} {order.quantity > 1 ? t.orders.items : t.orders.item}
            </p>
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Items */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-lg bg-slate-700/50 flex items-center justify-center">
              <Package className="h-6 w-6 text-teal-400" />
            </div>
            <div className="flex-1">
              <p className="text-white">{order.quantity}x TRMNL Photo Frame</p>
              <p className="text-slate-500 text-sm">
                {formatPrice(order.unitPrice)} {language === "zh" ? "每件" : "each"}
              </p>
            </div>
          </div>

          {/* Shipping address */}
          <div className="mb-4">
            <p className="text-slate-400 text-sm mb-1 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {t.orders.shippingTo}
            </p>
            <p className="text-slate-300 text-sm">{order.shipping.name}</p>
            <p className="text-slate-500 text-sm">
              {order.shipping.addressLine1}
              {order.shipping.addressLine2 && `, ${order.shipping.addressLine2}`}
            </p>
            <p className="text-slate-500 text-sm">
              {order.shipping.city}, {order.shipping.state} {order.shipping.postalCode}
            </p>
            <p className="text-slate-500 text-sm">{order.shipping.country}</p>
          </div>

          {/* Tracking info */}
          {order.tracking && order.tracking.number && (
            <div className="mb-4 p-3 bg-slate-700/30 rounded-lg">
              <p className="text-slate-400 text-sm mb-1 flex items-center gap-1">
                <Truck className="h-3 w-3" />
                {t.orders.tracking}
              </p>
              <p className="text-white text-sm font-mono">
                {order.tracking.number}
                {order.tracking.carrier && (
                  <span className="text-slate-400 ml-2">({order.tracking.carrier})</span>
                )}
              </p>
              {order.tracking.url && (
                <a
                  href={order.tracking.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-teal-400 text-sm mt-2 hover:text-teal-300 transition-colors"
                >
                  {t.orders.trackPackage}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* Gift details */}
          {order.isGift && (
            <div className="p-3 bg-pink-400/5 border border-pink-400/10 rounded-lg">
              <p className="text-pink-400 text-sm mb-1 flex items-center gap-1">
                <Gift className="h-3 w-3" />
                {language === "zh" ? `礼物送给 ${order.giftRecipientName}` : `Gift for ${order.giftRecipientName}`}
              </p>
              {order.giftMessage && (
                <p className="text-slate-400 text-sm italic">"{order.giftMessage}"</p>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="mt-4 pt-4 border-t border-slate-700/50 text-xs text-slate-500 space-y-1">
            {order.paidAt && <p>{t.orders.paid} {formatDate(order.paidAt)}</p>}
            {order.shippedAt && <p>{t.orders.shipped} {formatDate(order.shippedAt)}</p>}
            {order.deliveredAt && <p>{t.orders.delivered} {formatDate(order.deliveredAt)}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export function OrdersPage({ authHeaders, onNavigate, onOrderMore }: OrdersPageProps) {
  const { orders, isLoading, error } = useOrders()
  const { t, language } = useLanguage()

  const getOrderCountText = (count: number): string => {
    if (language === "zh") {
      return `${count} 个订单`
    }
    return count === 1 ? `${count} order` : `${count} orders`
  }

  // Order more button for header
  const orderMoreButton = (
    <Button
      size="sm"
      onClick={onOrderMore}
      className={cn(
        "rounded-xl font-medium text-white transition-all duration-300 hidden sm:flex",
        "bg-gradient-to-r from-teal-500 to-emerald-500",
        "hover:from-teal-400 hover:to-emerald-400"
      )}
    >
      <Plus className="h-4 w-4 mr-2" />
      {t.orders?.orderMore || "Order More"}
    </Button>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Standardized Header */}
      <PageHeader
        title={t.orders?.title || "Orders"}
        onNavigate={onNavigate}
        currentPage="orders"
        rightContent={orderMoreButton}
      />

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative max-w-2xl mx-auto p-4">
        {/* Stats & Mobile order button */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-slate-400 text-sm">
            {getOrderCountText(orders.length)}
          </p>
          <Button
            onClick={onOrderMore}
            className={cn(
              "rounded-xl font-medium text-white transition-all duration-300 sm:hidden",
              "bg-gradient-to-r from-teal-500 to-emerald-500",
              "hover:from-teal-400 hover:to-emerald-400"
            )}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t.orders?.orderMore || "Order More"}
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={() => onNavigate("chat")} variant="outline">
              {t.orders?.goBack || "Go Back"}
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-8 w-8 text-slate-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">{t.orders?.noOrdersTitle}</h2>
            <p className="text-slate-400 mb-6">
              {t.orders?.noOrdersDescription}
            </p>
            <Button
              onClick={onOrderMore}
              className={cn(
                "rounded-xl font-medium text-white transition-all duration-300",
                "bg-gradient-to-r from-teal-500 to-emerald-500",
                "hover:from-teal-400 hover:to-emerald-400",
                "shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
              )}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.orders?.orderNow || "Order Now"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} t={t} language={language} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
