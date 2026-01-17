import { useState, useEffect, FormEvent } from "react"
import { Settings, Key, Wifi, Loader2, Check, Copy, ExternalLink, Eye, EyeOff, Monitor } from "lucide-react"
import { Button } from "../components/ui/button"
import { PageHeader } from "../components/PageHeader"
import { cn } from "../lib/utils"

type AppPage = "chat" | "gallery" | "schedule" | "batch" | "orders" | "subscription" | "settings"

interface SettingsPageProps {
  userId: number
  authHeaders: { Authorization?: string }
  onNavigate: (page: AppPage) => void
  onLogout: () => void
  translations: {
    title: string
    subtitle: string
    deviceApiKeyLabel: string
    deviceApiKeyPlaceholder: string
    macAddressLabel: string
    macAddressPlaceholder: string
    backgroundColorLabel: string
    backgroundColorBlack: string
    backgroundColorWhite: string
    saveButton: string
    saving: string
    saveSuccess: string
    saveError: string
    backToChat: string
    webhookUrl: string
    webhookUrlNote: string
    notConfigured: string
  }
}

interface UserSettings {
  trmnl_device_api_key: string | null
  trmnl_mac_address: string | null
  trmnl_background_color: "black" | "white"
}

export function SettingsPage({ userId, authHeaders, onNavigate, onLogout, translations: t }: SettingsPageProps) {
  const [deviceApiKey, setDeviceApiKey] = useState("")
  const [macAddress, setMacAddress] = useState("")
  const [backgroundColor, setBackgroundColor] = useState<"black" | "white">("black")
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const webhookUrl = `${window.location.origin}/api/trmnl/webhook/${userId}`

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings", {
          headers: authHeaders,
        })
        if (response.ok) {
          const data: UserSettings = await response.json()
          setDeviceApiKey(data.trmnl_device_api_key || "")
          setMacAddress(data.trmnl_mac_address || "")
          setBackgroundColor(data.trmnl_background_color || "black")
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSettings()
  }, [authHeaders])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          trmnl_device_api_key: deviceApiKey || null,
          trmnl_mac_address: macAddress || null,
          trmnl_background_color: backgroundColor,
        }),
      })

      if (response.ok) {
        setMessage({ type: "success", text: t.saveSuccess })
      } else {
        const error = await response.json()
        setMessage({ type: "error", text: error.error || t.saveError })
      }
    } catch (error) {
      setMessage({ type: "error", text: t.saveError })
    } finally {
      setIsSaving(false)
    }
  }

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Standardized Header */}
      <PageHeader
        title={t.title}
        onNavigate={onNavigate}
        currentPage="settings"
        onLogout={onLogout}
      />

      <div className="flex items-center justify-center p-4">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-400/5 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-md relative">
          {/* Card */}
          <div className="bg-card backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-8">
            {/* Header */}
            <div className="flex flex-col items-center mb-8">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-teal-500/25">
                <Settings className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{t.subtitle}</h2>
            </div>

            {/* Message */}
            {message && (
              <div
                className={cn(
                  "mb-6 p-3 rounded-lg text-sm text-center animate-in fade-in slide-in-from-top-2 duration-300",
                  message.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                )}
              >
                {message.text}
              </div>
            )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Device API Key */}
            <div className="space-y-2">
              <label htmlFor="deviceApiKey" className="block text-sm font-medium text-foreground">
                {t.deviceApiKeyLabel}
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="deviceApiKey"
                  type={showApiKey ? "text" : "password"}
                  value={deviceApiKey}
                  onChange={(e) => setDeviceApiKey(e.target.value)}
                  placeholder={t.deviceApiKeyPlaceholder}
                  className="w-full pl-10 pr-12 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* MAC Address */}
            <div className="space-y-2">
              <label htmlFor="macAddress" className="block text-sm font-medium text-foreground">
                {t.macAddressLabel}
              </label>
              <div className="relative">
                <Wifi className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="macAddress"
                  type="text"
                  value={macAddress}
                  onChange={(e) => setMacAddress(e.target.value)}
                  placeholder={t.macAddressPlaceholder}
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-mono"
                />
              </div>
            </div>

            {/* Background Color Toggle */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                {t.backgroundColorLabel}
              </label>
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 flex bg-muted border border-border rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setBackgroundColor("black")}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                      backgroundColor === "black"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-black border border-border" />
                      {t.backgroundColorBlack}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundColor("white")}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                      backgroundColor === "white"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-white border border-border" />
                      {t.backgroundColorWhite}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={isSaving}
              className={cn(
                "w-full py-3 rounded-xl font-semibold text-white transition-all duration-300",
                "bg-gradient-to-r from-teal-500 to-emerald-500",
                "hover:from-teal-400 hover:to-emerald-400",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
              )}
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t.saving}
                </span>
              ) : (
                t.saveButton
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
          </div>

          {/* Webhook URL */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground">
              {t.webhookUrl}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 bg-muted border border-border rounded-xl text-foreground text-sm font-mono truncate">
                {webhookUrl}
              </div>
              <button
                type="button"
                onClick={copyWebhookUrl}
                className={cn(
                  "p-3 rounded-xl border transition-all",
                  copied
                    ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-500 dark:text-emerald-400"
                    : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                )}
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
            <p className="text-muted-foreground text-xs flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              {t.webhookUrlNote}
            </p>
          </div>
          </div>

          {/* Footer */}
          <p className="text-center text-muted-foreground text-xs mt-6">
            Powered by DALL-E 3 & TRMNL
          </p>
        </div>
      </div>
    </div>
  )
}
