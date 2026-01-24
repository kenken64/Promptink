import { useState, useEffect, FormEvent } from "react"
import { Settings, Loader2, Check, Copy, ExternalLink, Eye, EyeOff, Monitor, Lock, Plus, Trash2, Star, StarOff, Edit2, X, User, Mail, Globe, MapPin } from "lucide-react"
import { Button } from "../components/ui/button"
import { PageHeader } from "../components/PageHeader"
import { cn } from "../lib/utils"
import { useAuth } from "../hooks/useAuth"
import { TIMEZONE_OPTIONS, detectBrowserTimezone, getTimezoneLabel } from "../utils"

type AppPage = "chat" | "gallery" | "schedule" | "batch" | "orders" | "subscription" | "settings"

interface SettingsPageProps {
  userId: number
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
    changePassword: {
      title: string
      currentPasswordLabel: string
      currentPasswordPlaceholder: string
      newPasswordLabel: string
      newPasswordPlaceholder: string
      confirmPasswordLabel: string
      confirmPasswordPlaceholder: string
      submitButton: string
      submitting: string
      success: string
      error: string
      passwordMismatch: string
      passwordTooShort: string
    }
    timezone?: {
      title: string
      description: string
      detectFromBrowser: string
      detected: string
    }
    devices?: {
      title: string
      addDevice: string
      deviceName: string
      deviceNamePlaceholder: string
      noDevices: string
      deleteConfirm: string
      setDefault: string
      isDefault: string
      webhookUrl: string
      copyWebhook: string
      copied: string
    }
  }
}

interface Device {
  id: number
  name: string
  webhook_url: string
  background_color: "black" | "white"
  is_default: boolean
  created_at: string
  updated_at: string
}

export function SettingsPage({ userId, onNavigate, onLogout, translations: t }: SettingsPageProps) {
  const { authFetch, user } = useAuth()

  // Devices state
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoadingDevices, setIsLoadingDevices] = useState(true)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [newDeviceName, setNewDeviceName] = useState("")
  const [newDeviceWebhookUrl, setNewDeviceWebhookUrl] = useState("")
  const [newDeviceBackgroundColor, setNewDeviceBackgroundColor] = useState<"black" | "white">("black")
  const [isSavingDevice, setIsSavingDevice] = useState(false)
  const [deviceMessage, setDeviceMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [copiedDeviceId, setCopiedDeviceId] = useState<number | null>(null)

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Timezone state
  const [timezone, setTimezone] = useState<string>("UTC")
  const [isSavingTimezone, setIsSavingTimezone] = useState(false)
  const [timezoneMessage, setTimezoneMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Device translations with fallbacks
  const dt = t.devices || {
    title: "TRMNL Devices",
    addDevice: "Add Device",
    deviceName: "Device Name",
    deviceNamePlaceholder: "e.g., Living Room Display",
    noDevices: "No devices configured. Add your first TRMNL device to get started.",
    deleteConfirm: "Are you sure you want to delete this device?",
    setDefault: "Set as Default",
    isDefault: "Default",
    webhookUrl: "Webhook URL",
    copyWebhook: "Copy",
    copied: "Copied!",
  }

  // Fetch devices
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await authFetch("/api/devices")
        if (response.ok) {
          const data = await response.json()
          setDevices(data.devices || [])
        }
      } catch (error) {
        console.error("Failed to fetch devices:", error)
      } finally {
        setIsLoadingDevices(false)
      }
    }
    fetchDevices()
  }, [authFetch])

  // Fetch settings (including timezone)
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await authFetch("/api/settings")
        if (response.ok) {
          const data = await response.json()
          setTimezone(data.timezone || "UTC")
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error)
      }
    }
    fetchSettings()
  }, [authFetch])

  const handleAddDevice = async (e: FormEvent) => {
    e.preventDefault()
    if (!newDeviceName.trim() || !newDeviceWebhookUrl.trim()) return

    setIsSavingDevice(true)
    setDeviceMessage(null)

    try {
      const response = await authFetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDeviceName.trim(),
          webhook_url: newDeviceWebhookUrl.trim(),
          background_color: newDeviceBackgroundColor,
          is_default: devices.length === 0,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setDevices([...devices, data.device])
        setNewDeviceName("")
        setNewDeviceWebhookUrl("")
        setNewDeviceBackgroundColor("black")
        setShowAddDevice(false)
        setDeviceMessage({ type: "success", text: t.saveSuccess })
      } else {
        const error = await response.json()
        setDeviceMessage({ type: "error", text: error.error || t.saveError })
      }
    } catch (error) {
      setDeviceMessage({ type: "error", text: t.saveError })
    } finally {
      setIsSavingDevice(false)
    }
  }

  const handleUpdateDevice = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingDevice) return

    setIsSavingDevice(true)
    setDeviceMessage(null)

    try {
      const response = await authFetch(`/api/devices/${editingDevice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDeviceName.trim(),
          webhook_url: newDeviceWebhookUrl.trim(),
          background_color: newDeviceBackgroundColor,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setDevices(devices.map(d => d.id === editingDevice.id ? data.device : d))
        setEditingDevice(null)
        setNewDeviceName("")
        setNewDeviceWebhookUrl("")
        setNewDeviceBackgroundColor("black")
        setDeviceMessage({ type: "success", text: t.saveSuccess })
      } else {
        const error = await response.json()
        setDeviceMessage({ type: "error", text: error.error || t.saveError })
      }
    } catch (error) {
      setDeviceMessage({ type: "error", text: t.saveError })
    } finally {
      setIsSavingDevice(false)
    }
  }

  const handleDeleteDevice = async (deviceId: number) => {
    if (!confirm(dt.deleteConfirm)) return

    try {
      const response = await authFetch(`/api/devices/${deviceId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Refetch devices to get updated default status
        const devicesResponse = await authFetch("/api/devices")
        if (devicesResponse.ok) {
          const data = await devicesResponse.json()
          setDevices(data.devices || [])
        }
        setDeviceMessage({ type: "success", text: "Device deleted" })
      } else {
        const error = await response.json()
        setDeviceMessage({ type: "error", text: error.error || t.saveError })
      }
    } catch (error) {
      setDeviceMessage({ type: "error", text: t.saveError })
    }
  }

  const handleSetDefault = async (deviceId: number) => {
    try {
      const response = await authFetch(`/api/devices/${deviceId}/default`, {
        method: "POST",
      })

      if (response.ok) {
        setDevices(devices.map(d => ({
          ...d,
          is_default: d.id === deviceId,
        })))
      }
    } catch (error) {
      console.error("Failed to set default device:", error)
    }
  }

  const handleCopyWebhook = async (device: Device) => {
    await navigator.clipboard.writeText(device.webhook_url)
    setCopiedDeviceId(device.id)
    setTimeout(() => setCopiedDeviceId(null), 2000)
  }

  const startEditDevice = (device: Device) => {
    setEditingDevice(device)
    setNewDeviceName(device.name)
    setNewDeviceWebhookUrl(device.webhook_url)
    setNewDeviceBackgroundColor(device.background_color)
    setShowAddDevice(false)
  }

  const cancelEdit = () => {
    setEditingDevice(null)
    setShowAddDevice(false)
    setNewDeviceName("")
    setNewDeviceWebhookUrl("")
    setNewDeviceBackgroundColor("black")
  }

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordMessage(null)

    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: t.changePassword.passwordTooShort })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: t.changePassword.passwordMismatch })
      return
    }

    setIsChangingPassword(true)

    try {
      const response = await authFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      if (response.ok) {
        setPasswordMessage({ type: "success", text: t.changePassword.success })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        const error = await response.json()
        setPasswordMessage({ type: "error", text: error.error || t.changePassword.error })
      }
    } catch (error) {
      setPasswordMessage({ type: "error", text: t.changePassword.error })
    } finally {
      setIsChangingPassword(false)
    }
  }

  // Timezone translations with fallbacks
  const tz = t.timezone || {
    title: "Timezone",
    description: "Set your timezone for scheduled image generation",
    detectFromBrowser: "Detect from browser",
    detected: "Detected",
  }

  const handleTimezoneChange = async (newTimezone: string) => {
    setTimezone(newTimezone)
    setIsSavingTimezone(true)
    setTimezoneMessage(null)

    try {
      const response = await authFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: newTimezone }),
      })

      if (response.ok) {
        setTimezoneMessage({ type: "success", text: t.saveSuccess })
        setTimeout(() => setTimezoneMessage(null), 3000)
      } else {
        const error = await response.json()
        setTimezoneMessage({ type: "error", text: error.error || t.saveError })
      }
    } catch (error) {
      setTimezoneMessage({ type: "error", text: t.saveError })
    } finally {
      setIsSavingTimezone(false)
    }
  }

  const handleDetectTimezone = () => {
    const detected = detectBrowserTimezone()
    handleTimezoneChange(detected)
  }

  if (isLoadingDevices) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <PageHeader
        title={t.title}
        onNavigate={onNavigate}
        currentPage="settings"
        onLogout={onLogout}
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex items-center justify-center p-4 pb-8">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>

          <div className="w-full max-w-md relative">
            <div className="bg-card backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-8">
              {/* Header */}
              <div className="flex flex-col items-center mb-8">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-teal-500/25">
                  <Settings className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-foreground">{t.subtitle}</h2>
              </div>

              {/* Account Section */}
              <div className="mb-8 p-4 bg-muted/50 rounded-xl border border-border">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-teal-500" />
                  Account
                </h3>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-foreground font-medium">{user?.email || "—"}</p>
                  </div>
                </div>
                {user?.name && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="text-foreground">{user.name}</p>
                  </div>
                )}
              </div>

              {/* Timezone Section */}
              <div className="mb-8 p-4 bg-muted/50 rounded-xl border border-border">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-2">
                  <Globe className="h-5 w-5 text-teal-500" />
                  {tz.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">{tz.description}</p>

                {timezoneMessage && (
                  <div
                    className={cn(
                      "mb-4 p-2 rounded-lg text-sm text-center animate-in fade-in slide-in-from-top-2 duration-300",
                      timezoneMessage.type === "success"
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border border-red-500/20 text-red-400"
                    )}
                  >
                    {timezoneMessage.text}
                  </div>
                )}

                <div className="space-y-3">
                  <select
                    value={timezone}
                    onChange={(e) => handleTimezoneChange(e.target.value)}
                    disabled={isSavingTimezone}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-50"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label} ({tz.offset})
                      </option>
                    ))}
                    {/* Include current timezone if not in list */}
                    {!TIMEZONE_OPTIONS.find(o => o.value === timezone) && (
                      <option value={timezone}>
                        {getTimezoneLabel(timezone)}
                      </option>
                    )}
                  </select>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDetectTimezone}
                    disabled={isSavingTimezone}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    {tz.detectFromBrowser}
                    {isSavingTimezone && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                  </Button>
                </div>
              </div>

              {/* Device Message */}
              {deviceMessage && (
                <div
                  className={cn(
                    "mb-6 p-3 rounded-lg text-sm text-center animate-in fade-in slide-in-from-top-2 duration-300",
                    deviceMessage.type === "success"
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border border-red-500/20 text-red-400"
                  )}
                >
                  {deviceMessage.text}
                </div>
              )}

              {/* TRMNL Devices Section */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-teal-500" />
                    {dt.title}
                  </h3>
                  {!showAddDevice && !editingDevice && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowAddDevice(true)}
                      className="text-teal-500 hover:text-teal-400"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {dt.addDevice}
                    </Button>
                  )}
                </div>

                {/* Add/Edit Device Form */}
                {(showAddDevice || editingDevice) && (
                  <form onSubmit={editingDevice ? handleUpdateDevice : handleAddDevice} noValidate className="space-y-4 p-4 bg-muted/50 rounded-xl border border-border">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">
                        {editingDevice ? "Edit Device" : "Add New Device"}
                      </h4>
                      <button type="button" onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">
                        {dt.deviceName}
                      </label>
                      <input
                        type="text"
                        value={newDeviceName}
                        onChange={(e) => setNewDeviceName(e.target.value)}
                        placeholder={dt.deviceNamePlaceholder}
                        required
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">
                        {dt.webhookUrl}
                      </label>
                      <input
                        type="url"
                        value={newDeviceWebhookUrl}
                        onChange={(e) => setNewDeviceWebhookUrl(e.target.value)}
                        placeholder="https://usetrmnl.com/api/custom_plugins/..."
                        required
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t.webhookUrlNote}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">
                        {t.backgroundColorLabel}
                      </label>
                      <div className="flex bg-muted border border-border rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => setNewDeviceBackgroundColor("black")}
                          className={cn(
                            "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                            newDeviceBackgroundColor === "black"
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
                          onClick={() => setNewDeviceBackgroundColor("white")}
                          className={cn(
                            "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                            newDeviceBackgroundColor === "white"
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

                    <Button
                      type="submit"
                      disabled={isSavingDevice || !newDeviceName.trim() || !newDeviceWebhookUrl.trim()}
                      className={cn(
                        "w-full py-3 rounded-xl font-semibold text-white transition-all duration-300",
                        "bg-gradient-to-r from-teal-500 to-emerald-500",
                        "hover:from-teal-400 hover:to-emerald-400",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {isSavingDevice ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {t.saving}
                        </span>
                      ) : (
                        t.saveButton
                      )}
                    </Button>
                  </form>
                )}

                {/* Device List */}
                {devices.length === 0 && !showAddDevice ? (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    {dt.noDevices}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {devices.map((device) => (
                      <div
                        key={device.id}
                        className={cn(
                          "p-4 rounded-xl border transition-all",
                          device.is_default
                            ? "bg-teal-500/10 border-teal-500/30"
                            : "bg-muted/50 border-border"
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{device.name}</span>
                            {device.is_default && (
                              <span className="text-xs px-2 py-0.5 bg-teal-500/20 text-teal-400 rounded-full flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                {dt.isDefault}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {!device.is_default && (
                              <button
                                onClick={() => handleSetDefault(device.id)}
                                className="p-1.5 text-muted-foreground hover:text-teal-500 transition-colors"
                                title={dt.setDefault}
                              >
                                <StarOff className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => startEditDevice(device)}
                              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDevice(device.id)}
                              className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <span className={cn(
                            "w-3 h-3 rounded-full border border-border",
                            device.background_color === "black" ? "bg-black" : "bg-white"
                          )} />
                          <span>Background: {device.background_color}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-xs font-mono truncate">
                            {device.webhook_url}
                          </div>
                          <button
                            onClick={() => handleCopyWebhook(device)}
                            className={cn(
                              "p-2 rounded-lg border transition-all",
                              copiedDeviceId === device.id
                                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                                : "bg-muted border-border text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {copiedDeviceId === device.id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
              </div>

              {/* Change Password Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Lock className="h-5 w-5 text-teal-500" />
                  {t.changePassword.title}
                </h3>

                {passwordMessage && (
                  <div
                    className={cn(
                      "p-3 rounded-lg text-sm text-center animate-in fade-in slide-in-from-top-2 duration-300",
                      passwordMessage.type === "success"
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border border-red-500/20 text-red-400"
                    )}
                  >
                    {passwordMessage.text}
                  </div>
                )}

                <form onSubmit={handleChangePassword} noValidate className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground">
                      {t.changePassword.currentPasswordLabel}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder={t.changePassword.currentPasswordPlaceholder}
                        required
                        className="w-full pl-10 pr-12 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="newPassword" className="block text-sm font-medium text-foreground">
                      {t.changePassword.newPasswordLabel}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t.changePassword.newPasswordPlaceholder}
                        required
                        minLength={8}
                        className="w-full pl-10 pr-12 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                      {t.changePassword.confirmPasswordLabel}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t.changePassword.confirmPasswordPlaceholder}
                        required
                        minLength={8}
                        className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className={cn(
                      "w-full py-3 rounded-xl font-semibold text-white transition-all duration-300",
                      "bg-gradient-to-r from-teal-500 to-emerald-500",
                      "hover:from-teal-400 hover:to-emerald-400",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
                    )}
                  >
                    {isChangingPassword ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {t.changePassword.submitting}
                      </span>
                    ) : (
                      t.changePassword.submitButton
                    )}
                  </Button>
                </form>
              </div>
            </div>

            <p className="text-center text-muted-foreground text-xs mt-6 mb-4">
              Powered by DALL-E 3 & TRMNL
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
