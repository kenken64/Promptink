import { useState, useEffect, useRef } from "react"
import { Lock, RefreshCw, Users, Image, CreditCard, Crown, ChevronLeft, ChevronRight, Mail, Calendar, Download, Upload, Database, AlertCircle, CheckCircle, ArrowRight, Monitor, Plus, Trash2, Edit2, X, Star, Save, Eye, EyeOff, DollarSign, Cpu, ImageIcon, Zap, Sparkles, MessageSquare, Loader2 } from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"

interface AdminStats {
  totalUsers: number
  totalImages: number
  paidOrders: number
  activeSubscriptions: number
}

interface OpenAIUsage {
  images: { total: number; byModel: Record<string, number>; bySize: Record<string, number> }
  costs: { total: number; currency: string; byLineItem: Record<string, number> }
  completions: { inputTokens: number; outputTokens: number; requests: number }
  period: { start: string; end: string }
  error?: string
}

interface Device {
  id: number
  name: string
  webhook_url: string
  background_color: "black" | "white"
  is_default: boolean
  mac_address: string | null
  device_api_key: string | null
  created_at: string
  updated_at: string
}

interface User {
  id: number
  email: string
  name: string | null
  subscription_status: string | null
  created_at: string
}

interface UsersResponse {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Retro flip counter digit component
function FlipDigit({ digit, prevDigit }: { digit: string; prevDigit: string }) {
  const [isFlipping, setIsFlipping] = useState(false)

  useEffect(() => {
    if (digit !== prevDigit) {
      setIsFlipping(true)
      const timer = setTimeout(() => setIsFlipping(false), 600)
      return () => clearTimeout(timer)
    }
  }, [digit, prevDigit])

  return (
    <div className="relative w-12 h-16 sm:w-16 sm:h-20 mx-0.5">
      {/* Background card */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-lg shadow-lg border border-zinc-700" />
      
      {/* Top half (static) */}
      <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden rounded-t-lg">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-700 to-zinc-800 flex items-end justify-center pb-0">
          <span className="text-3xl sm:text-4xl font-bold text-white font-mono" style={{ transform: "translateY(50%)" }}>
            {digit}
          </span>
        </div>
      </div>
      
      {/* Bottom half (static) */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden rounded-b-lg">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900 flex items-start justify-center pt-0">
          <span className="text-3xl sm:text-4xl font-bold text-zinc-300 font-mono" style={{ transform: "translateY(-50%)" }}>
            {digit}
          </span>
        </div>
      </div>
      
      {/* Center line */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-black/50 z-10" />
      
      {/* Flip animation overlay */}
      {isFlipping && (
        <>
          {/* Top flipping card */}
          <div 
            className="absolute inset-x-0 top-0 h-1/2 overflow-hidden rounded-t-lg origin-bottom z-20"
            style={{
              animation: "flipTop 0.3s ease-in forwards",
              backfaceVisibility: "hidden",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-700 to-zinc-800 flex items-end justify-center pb-0">
              <span className="text-3xl sm:text-4xl font-bold text-white font-mono" style={{ transform: "translateY(50%)" }}>
                {prevDigit}
              </span>
            </div>
          </div>
          
          {/* Bottom flipping card */}
          <div 
            className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden rounded-b-lg origin-top z-20"
            style={{
              animation: "flipBottom 0.3s ease-out 0.3s forwards",
              backfaceVisibility: "hidden",
              transform: "rotateX(90deg)",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900 flex items-start justify-center pt-0">
              <span className="text-3xl sm:text-4xl font-bold text-zinc-300 font-mono" style={{ transform: "translateY(-50%)" }}>
                {digit}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Retro counter component
function RetroCounter({ value, label, icon: Icon }: { value: number; label: string; icon: React.ElementType }) {
  const [displayValue, setDisplayValue] = useState(0)
  const [prevDigits, setPrevDigits] = useState("00000")
  
  // Animate counting up
  useEffect(() => {
    if (value === 0) return
    
    const duration = 2000
    const steps = 60
    const increment = value / steps
    let current = 0
    let step = 0
    
    const timer = setInterval(() => {
      step++
      current = Math.min(Math.round(increment * step), value)
      setPrevDigits(displayValue.toString().padStart(5, "0"))
      setDisplayValue(current)
      
      if (step >= steps) {
        clearInterval(timer)
      }
    }, duration / steps)
    
    return () => clearInterval(timer)
  }, [value])
  
  const digits = displayValue.toString().padStart(5, "0").split("")
  const prevDigitsArr = prevDigits.split("")
  
  return (
    <div className="flex flex-col items-center p-6 bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl">
      <div className="flex items-center gap-2 mb-4 text-zinc-400">
        <Icon className="h-5 w-5" />
        <span className="text-sm font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex">
        {digits.map((digit, i) => (
          <FlipDigit key={i} digit={digit} prevDigit={prevDigitsArr[i]} />
        ))}
      </div>
    </div>
  )
}

export function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [usersData, setUsersData] = useState<UsersResponse | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [backupMessage, setBackupMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressStatus, setProgressStatus] = useState("")
  const [oldUrl, setOldUrl] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Device management state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>("")
  const [userDevices, setUserDevices] = useState<Device[]>([])
  const [isLoadingDevices, setIsLoadingDevices] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [isAddingDevice, setIsAddingDevice] = useState(false)
  const [deviceForm, setDeviceForm] = useState({
    name: "",
    webhook_url: "",
    background_color: "black" as "black" | "white",
    mac_address: "",
    device_api_key: "",
  })
  const [isSavingDevice, setIsSavingDevice] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  
  // OpenAI usage state
  const [openaiUsage, setOpenaiUsage] = useState<OpenAIUsage | null>(null)
  const [isLoadingOpenaiUsage, setIsLoadingOpenaiUsage] = useState(false)

  // Check if any blocking operation is in progress
  const isBlocking = isExporting || isImporting

  // Check for existing token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token")
    if (savedToken) {
      verifyToken(savedToken)
    }
  }, [])

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await fetch("/api/admin/verify", {
        headers: { Authorization: `Bearer ${tokenToVerify}` },
      })
      if (response.ok) {
        setToken(tokenToVerify)
        setIsAuthenticated(true)
        fetchStats(tokenToVerify)
        fetchOpenAIUsage(tokenToVerify)
        fetchUsers(tokenToVerify, 1)
      } else {
        localStorage.removeItem("admin_token")
      }
    } catch {
      localStorage.removeItem("admin_token")
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Login failed")
      }

      const data = await response.json()
      localStorage.setItem("admin_token", data.token)
      setToken(data.token)
      setIsAuthenticated(true)
      fetchStats(data.token)
      fetchOpenAIUsage(data.token)
      fetchUsers(data.token, 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStats = async (authToken: string) => {
    try {
      const response = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err)
    }
  }

  const fetchOpenAIUsage = async (authToken: string) => {
    setIsLoadingOpenaiUsage(true)
    try {
      const response = await fetch("/api/admin/openai-usage", {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (response.ok) {
        const data = await response.json()
        setOpenaiUsage(data)
      }
    } catch (err) {
      console.error("Failed to fetch OpenAI usage:", err)
    } finally {
      setIsLoadingOpenaiUsage(false)
    }
  }

  const fetchUsers = async (authToken: string, page: number) => {
    setIsLoadingUsers(true)
    try {
      const response = await fetch(`/api/admin/users?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (response.ok) {
        const data = await response.json()
        setUsersData(data)
        setCurrentPage(page)
      }
    } catch (err) {
      console.error("Failed to fetch users:", err)
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const handleRefresh = () => {
    if (token) {
      setStats(null)
      setOpenaiUsage(null)
      setTimeout(() => fetchStats(token), 100)
      fetchOpenAIUsage(token)
      fetchUsers(token, currentPage)
    }
  }

  const handlePageChange = (newPage: number) => {
    if (token && newPage >= 1 && newPage <= (usersData?.pagination.totalPages || 1)) {
      fetchUsers(token, newPage)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("admin_token")
    setToken(null)
    setIsAuthenticated(false)
    setStats(null)
    setUsersData(null)
    setPassword("")
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getSubscriptionBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400">Active</span>
      case "cancelled":
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/20 text-red-400">Cancelled</span>
      case "past_due":
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-500/20 text-yellow-400">Past Due</span>
      default:
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-zinc-700/50 text-zinc-400">None</span>
    }
  }

  // Device Management Functions
  const fetchUserDevices = async (userId: number) => {
    if (!token) return
    setIsLoadingDevices(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setUserDevices(data.devices || [])
      }
    } catch (err) {
      console.error("Failed to fetch user devices:", err)
    } finally {
      setIsLoadingDevices(false)
    }
  }

  const openDeviceManager = (user: User) => {
    setSelectedUserId(user.id)
    setSelectedUserEmail(user.email)
    setEditingDevice(null)
    setIsAddingDevice(false)
    resetDeviceForm()
    fetchUserDevices(user.id)
  }

  const closeDeviceManager = () => {
    setSelectedUserId(null)
    setSelectedUserEmail("")
    setUserDevices([])
    setEditingDevice(null)
    setIsAddingDevice(false)
    resetDeviceForm()
  }

  const resetDeviceForm = () => {
    setDeviceForm({
      name: "",
      webhook_url: "",
      background_color: "#FFFFFF",
      mac_address: "",
      device_api_key: ""
    })
  }

  const startEditDevice = (device: Device) => {
    setEditingDevice(device)
    setIsAddingDevice(false)
    setDeviceForm({
      name: device.name,
      webhook_url: device.webhook_url || "",
      background_color: device.background_color,
      mac_address: device.mac_address || "",
      device_api_key: device.device_api_key || ""
    })
  }

  const startAddDevice = () => {
    setEditingDevice(null)
    setIsAddingDevice(true)
    resetDeviceForm()
  }

  const cancelDeviceEdit = () => {
    setEditingDevice(null)
    setIsAddingDevice(false)
    resetDeviceForm()
  }

  const handleSaveDevice = async () => {
    if (!token || !selectedUserId) return
    setIsSavingDevice(true)
    
    try {
      const payload = {
        name: deviceForm.name || "My Device",
        webhook_url: deviceForm.webhook_url || null,
        background_color: deviceForm.background_color,
        mac_address: deviceForm.mac_address || null,
        device_api_key: deviceForm.device_api_key || null
      }

      let response: Response
      if (editingDevice) {
        // Update existing device
        response = await fetch(`/api/admin/devices/${editingDevice.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
      } else {
        // Create new device
        response = await fetch(`/api/admin/users/${selectedUserId}/devices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
      }

      if (response.ok) {
        await fetchUserDevices(selectedUserId)
        setEditingDevice(null)
        setIsAddingDevice(false)
        resetDeviceForm()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to save device")
      }
    } catch (err) {
      console.error("Failed to save device:", err)
      alert("Failed to save device")
    } finally {
      setIsSavingDevice(false)
    }
  }

  const handleDeleteDevice = async (deviceId: number) => {
    if (!token || !selectedUserId) return
    if (!confirm("Are you sure you want to delete this device?")) return

    try {
      const response = await fetch(`/api/admin/devices/${deviceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        await fetchUserDevices(selectedUserId)
      } else {
        const error = await response.json()
        alert(error.error || "Failed to delete device")
      }
    } catch (err) {
      console.error("Failed to delete device:", err)
      alert("Failed to delete device")
    }
  }

  const handleSetDefaultDevice = async (deviceId: number) => {
    if (!token || !selectedUserId) return

    try {
      const response = await fetch(`/api/admin/devices/${deviceId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_default: true })
      })

      if (response.ok) {
        await fetchUserDevices(selectedUserId)
      }
    } catch (err) {
      console.error("Failed to set default device:", err)
    }
  }

  const handleExport = async () => {
    if (!token) return
    
    setIsExporting(true)
    setBackupMessage(null)
    setProgress(0)
    setProgressStatus("Preparing export...")
    
    try {
      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest()
      
      const result = await new Promise<{ blob: Blob; filename: string }>((resolve, reject) => {
        xhr.open("GET", "/api/admin/export", true)
        xhr.setRequestHeader("Authorization", `Bearer ${token}`)
        xhr.responseType = "blob"
        
        xhr.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100)
            setProgress(percent)
            setProgressStatus(`Downloading... ${(event.loaded / (1024 * 1024)).toFixed(2)} MB / ${(event.total / (1024 * 1024)).toFixed(2)} MB`)
          } else {
            // If length is not computable, show indeterminate progress
            setProgress(Math.min(90, progress + 5))
            setProgressStatus(`Downloading... ${(event.loaded / (1024 * 1024)).toFixed(2)} MB`)
          }
        }
        
        xhr.onload = () => {
          if (xhr.status === 200) {
            const contentDisposition = xhr.getResponseHeader("Content-Disposition")
            let filename = "promptink-backup.zip"
            if (contentDisposition) {
              const match = contentDisposition.match(/filename="(.+)"/)
              if (match) filename = match[1]
            }
            resolve({ blob: xhr.response as Blob, filename })
          } else {
            reject(new Error("Export failed"))
          }
        }
        
        xhr.onerror = () => reject(new Error("Network error"))
        xhr.send()
      })
      
      setProgress(100)
      setProgressStatus("Download complete!")
      
      // Download the file
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement("a")
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      setBackupMessage({ type: "success", text: "Backup downloaded successfully!" })
    } catch (err) {
      setBackupMessage({ type: "error", text: err instanceof Error ? err.message : "Export failed" })
    } finally {
      setIsExporting(false)
      setProgress(0)
      setProgressStatus("")
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!token || !e.target.files?.length) return
    
    const file = e.target.files[0]
    
    if (!file.name.endsWith(".zip")) {
      setBackupMessage({ type: "error", text: "Please select a .zip file" })
      return
    }
    
    const confirmed = window.confirm(
      "Warning: This will overwrite existing data. Are you sure you want to restore from this backup?"
    )
    
    if (!confirmed) {
      e.target.value = ""
      return
    }
    
    setIsImporting(true)
    setBackupMessage(null)
    setProgress(0)
    setProgressStatus("Preparing upload...")
    
    try {
      const formData = new FormData()
      formData.append("file", file)
      
      // Add URL migration fields if provided
      if (oldUrl.trim()) {
        formData.append("oldUrl", oldUrl.trim())
      }
      if (newUrl.trim()) {
        formData.append("newUrl", newUrl.trim())
      }
      
      // Use XMLHttpRequest for upload progress tracking
      const result = await new Promise<{ success: boolean; message: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 90) // Reserve 10% for server processing
            setProgress(percent)
            setProgressStatus(`Uploading... ${(event.loaded / (1024 * 1024)).toFixed(2)} MB / ${(event.total / (1024 * 1024)).toFixed(2)} MB`)
          }
        }
        
        xhr.onload = () => {
          setProgress(95)
          setProgressStatus(oldUrl.trim() && newUrl.trim() ? "Processing and migrating URLs..." : "Processing on server...")
          
          try {
            const data = JSON.parse(xhr.responseText)
            if (xhr.status === 200) {
              setProgress(100)
              setProgressStatus("Import complete!")
              resolve({ success: true, message: data.message || "Backup restored successfully!" })
            } else {
              reject(new Error(data.error || "Import failed"))
            }
          } catch {
            reject(new Error("Invalid server response"))
          }
        }
        
        xhr.onerror = () => reject(new Error("Network error"))
        
        xhr.open("POST", "/api/admin/import", true)
        xhr.setRequestHeader("Authorization", `Bearer ${token}`)
        xhr.send(formData)
      })
      
      setBackupMessage({ type: "success", text: result.message })
      
      // Clear URL fields after successful import
      setOldUrl("")
      setNewUrl("")
      
      // Refresh data
      fetchStats(token)
      fetchUsers(token, 1)
    } catch (err) {
      setBackupMessage({ type: "error", text: err instanceof Error ? err.message : "Import failed" })
    } finally {
      setIsImporting(false)
      setProgress(0)
      setProgressStatus("")
      e.target.value = ""
    }
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 mb-4">
              <Lock className="h-8 w-8 text-teal-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Access</h1>
            <p className="text-zinc-500 mt-2">Enter the admin password to continue</p>
          </div>

          <form onSubmit={handleLogin} noValidate className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
              autoFocus
            />
            
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={isLoading || !password}
            >
              {isLoading ? "Authenticating..." : "Login"}
            </Button>
          </form>
        </div>

        {/* CSS for flip animations */}
        <style>{`
          @keyframes flipTop {
            0% { transform: rotateX(0deg); }
            100% { transform: rotateX(-90deg); }
          }
          @keyframes flipBottom {
            0% { transform: rotateX(90deg); }
            100% { transform: rotateX(0deg); }
          }
        `}</style>
      </div>
    )
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-zinc-950 p-4 sm:p-8">
      {/* Blocking overlay with progress bar */}
      {isBlocking && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-500/20 mb-4">
                {isExporting ? (
                  <Download className="h-8 w-8 text-teal-500 animate-bounce" />
                ) : (
                  <Upload className="h-8 w-8 text-teal-500 animate-bounce" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-white">
                {isExporting ? "Exporting Data" : "Importing Data"}
              </h3>
              <p className="text-zinc-400 mt-2">
                {progressStatus || "Please wait..."}
              </p>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-center mt-3">
              <span className="text-2xl font-bold text-white">{progress}%</span>
            </div>
            
            <p className="text-zinc-500 text-sm text-center mt-4">
              Please do not close this page or navigate away.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">PromptInk Admin</h1>
            <p className="text-zinc-500">Dashboard & Statistics</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="border-zinc-700 text-zinc-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-zinc-700 text-zinc-400 hover:text-white"
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RetroCounter
            value={stats?.totalUsers || 0}
            label="Total Registered Users"
            icon={Users}
          />
          <RetroCounter
            value={stats?.totalImages || 0}
            label="Total Generated Images"
            icon={Image}
          />
          <RetroCounter
            value={stats?.paidOrders || 0}
            label="Paid Orders"
            icon={CreditCard}
          />
          <RetroCounter
            value={stats?.activeSubscriptions || 0}
            label="Active Subscriptions"
            icon={Crown}
          />
        </div>

        {/* OpenAI Usage & Costs */}
        <div className="mt-8 bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              OpenAI Usage & Costs
              {openaiUsage?.period?.start && (
                <span className="text-xs font-normal text-zinc-500 ml-2">
                  ({new Date(openaiUsage.period.start).toLocaleDateString()} - {new Date(openaiUsage.period.end).toLocaleDateString()})
                </span>
              )}
            </h2>
          </div>
          <div className="p-6">
            {isLoadingOpenaiUsage ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                <span className="ml-2 text-zinc-500">Loading OpenAI usage...</span>
              </div>
            ) : openaiUsage?.error ? (
              <div className="bg-red-500/20 text-red-400 p-4 rounded-lg">
                <p className="text-sm">{openaiUsage.error}</p>
                <p className="text-xs mt-1 text-red-500">Make sure OPENAI_ADMIN_KEY is set in your environment.</p>
              </div>
            ) : openaiUsage ? (
              <div className="space-y-6">
                {/* Costs Summary */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Costs This Period
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                      <div className="text-2xl font-bold text-emerald-400">
                        ${(Number(openaiUsage.costs.total) || 0).toFixed(4)}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">Total Cost ({(openaiUsage.costs.currency ?? 'usd').toUpperCase()})</div>
                    </div>
                    {Object.entries(openaiUsage.costs.byLineItem || {}).map(([item, cost]) => (
                      <div key={item} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                        <div className="text-lg font-semibold text-zinc-200">
                          ${(Number(cost) || 0).toFixed(4)}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">{item}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Images Usage */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Images Generated
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-zinc-800/50 rounded-xl p-4 border border-purple-500/30">
                      <div className="text-2xl font-bold text-purple-400">
                        {openaiUsage.images.total}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">Total Images</div>
                    </div>
                    {Object.entries(openaiUsage.images.byModel).map(([model, count]) => (
                      <div key={model} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                        <div className="text-lg font-semibold text-zinc-200">{count as number}</div>
                        <div className="text-xs text-zinc-500 mt-1">{model}</div>
                      </div>
                    ))}
                  </div>
                  {Object.keys(openaiUsage.images.bySize).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(openaiUsage.images.bySize).map(([size, count]) => (
                        <span key={size} className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400">
                          {size}: {count as number}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Completions Usage */}
                {openaiUsage.completions.inputTokens > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Completions (GPT)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                        <div className="text-lg font-semibold text-blue-400">
                          {openaiUsage.completions.inputTokens.toLocaleString()}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">Input Tokens</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                        <div className="text-lg font-semibold text-teal-400">
                          {openaiUsage.completions.outputTokens.toLocaleString()}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">Output Tokens</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                        <div className="text-lg font-semibold text-zinc-200">
                          {(openaiUsage.completions.inputTokens + openaiUsage.completions.outputTokens).toLocaleString()}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">Total Tokens</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-zinc-500 text-sm">
                No OpenAI usage data available. Ensure OPENAI_ADMIN_KEY is configured.
              </div>
            )}
          </div>
        </div>

        {/* Data Backup & Restore */}
        <div className="mt-8 bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-teal-500" />
              Data Backup & Restore
            </h2>
          </div>
          <div className="p-6">
            <p className="text-zinc-400 text-sm mb-4">
              Export all data from the /app/data volume as a ZIP file for backup, or restore from a previously exported backup.
            </p>
            
            {backupMessage && (
              <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                backupMessage.type === "success" 
                  ? "bg-emerald-500/20 text-emerald-400" 
                  : "bg-red-500/20 text-red-400"
              }`}>
                {backupMessage.type === "success" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span className="text-sm">{backupMessage.text}</span>
              </div>
            )}
            
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={handleExport}
                disabled={isExporting || isImporting}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Data (ZIP)
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleImportClick}
                disabled={isExporting || isImporting}
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:text-white"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import from Backup
                  </>
                )}
              </Button>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".zip"
                className="hidden"
              />
            </div>
            
            {/* URL Migration Section */}
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <h3 className="text-sm font-medium text-white mb-2">URL Migration (Optional)</h3>
              <p className="text-zinc-500 text-xs mb-4">
                If you're migrating from another server, enter the old URL and new URL to update all image references in the database.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-zinc-500 mb-1">Old Server URL</label>
                  <Input
                    type="url"
                    placeholder="https://old-server.example.com"
                    value={oldUrl}
                    onChange={(e) => setOldUrl(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 text-sm"
                    disabled={isExporting || isImporting}
                  />
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-600 mt-5 hidden sm:block" />
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-zinc-500 mb-1">New Server URL</label>
                  <Input
                    type="url"
                    placeholder="https://new-server.example.com"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 text-sm"
                    disabled={isExporting || isImporting}
                  />
                </div>
              </div>
              {oldUrl && newUrl && (
                <p className="text-teal-400 text-xs mt-2">
                  ✓ URLs will be migrated during import: {oldUrl} → {newUrl}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="mt-8 bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-500" />
              Registered Users
            </h2>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">ID</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Subscription</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Joined</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Devices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Loading users...
                    </td>
                  </tr>
                ) : usersData?.users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  usersData?.users.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-zinc-400 font-mono">#{user.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm text-white">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-300">{user.name || "—"}</td>
                      <td className="px-6 py-4">{getSubscriptionBadge(user.subscription_status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <Calendar className="h-4 w-4" />
                          {formatDate(user.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeviceManager(user)}
                          className="border-zinc-700 text-zinc-400 hover:text-white hover:border-teal-500"
                        >
                          <Monitor className="h-4 w-4 mr-1" />
                          Manage
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {usersData && usersData.pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between">
              <div className="text-sm text-zinc-500">
                Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, usersData.pagination.total)} of {usersData.pagination.total} users
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isLoadingUsers}
                  className="border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="px-3 py-1 bg-zinc-800 rounded text-sm text-white">
                  Page {currentPage} of {usersData.pagination.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === usersData.pagination.totalPages || isLoadingUsers}
                  className="border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* CSS for flip animations */}
        <style>{`
          @keyframes flipTop {
            0% { transform: rotateX(0deg); }
            100% { transform: rotateX(-90deg); }
          }
          @keyframes flipBottom {
            0% { transform: rotateX(90deg); }
            100% { transform: rotateX(0deg); }
          }
        `}</style>

        {/* Device Manager Modal */}
        {selectedUserId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-teal-500" />
                    Devices for {selectedUserEmail}
                  </h2>
                  <p className="text-sm text-zinc-500 mt-1">Manage TRMNL devices for this user</p>
                </div>
                <button
                  onClick={closeDeviceManager}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto p-6">
                {/* Device List */}
                {isLoadingDevices ? (
                  <div className="text-center py-8 text-zinc-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading devices...
                  </div>
                ) : userDevices.length === 0 && !isAddingDevice ? (
                  <div className="text-center py-8 text-zinc-500">
                    <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No devices configured for this user</p>
                    <Button
                      onClick={startAddDevice}
                      className="mt-4 bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add First Device
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Existing Devices */}
                    {userDevices.map((device) => (
                      <div
                        key={device.id}
                        className={`bg-zinc-800/50 rounded-xl p-4 border ${
                          editingDevice?.id === device.id ? "border-teal-500" : "border-zinc-700"
                        }`}
                      >
                        {editingDevice?.id === device.id ? (
                          /* Edit Form */
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-1">Device Name</label>
                                <input
                                  type="text"
                                  value={deviceForm.name}
                                  onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                                  placeholder="My TRMNL"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-1">Background Color</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={deviceForm.background_color}
                                    onChange={(e) => setDeviceForm({ ...deviceForm, background_color: e.target.value })}
                                    className="w-10 h-10 rounded cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    value={deviceForm.background_color}
                                    onChange={(e) => setDeviceForm({ ...deviceForm, background_color: e.target.value })}
                                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-zinc-400 mb-1">Webhook URL</label>
                              <input
                                type="text"
                                value={deviceForm.webhook_url}
                                onChange={(e) => setDeviceForm({ ...deviceForm, webhook_url: e.target.value })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                                placeholder="https://usetrmnl.com/api/custom_plugins/..."
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-1">
                                  MAC Address <span className="text-teal-500">(Admin Only)</span>
                                </label>
                                <input
                                  type="text"
                                  value={deviceForm.mac_address}
                                  onChange={(e) => setDeviceForm({ ...deviceForm, mac_address: e.target.value })}
                                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                                  placeholder="AA:BB:CC:DD:EE:FF"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-1">
                                  Device API Key <span className="text-teal-500">(Admin Only)</span>
                                </label>
                                <div className="relative">
                                  <input
                                    type={showApiKey ? "text" : "password"}
                                    value={deviceForm.device_api_key}
                                    onChange={(e) => setDeviceForm({ ...deviceForm, device_api_key: e.target.value })}
                                    className="w-full px-3 py-2 pr-10 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                                    placeholder="Enter device API key"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition-colors"
                                  >
                                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelDeviceEdit}
                                className="border-zinc-700 text-zinc-400"
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveDevice}
                                disabled={isSavingDevice}
                                className="bg-teal-600 hover:bg-teal-700 text-white"
                              >
                                {isSavingDevice ? (
                                  <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <Save className="h-4 w-4 mr-1" />
                                )}
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Display Mode */
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-lg border border-zinc-600"
                                style={{ backgroundColor: device.background_color }}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white">{device.name}</span>
                                  {device.is_default && (
                                    <span className="px-2 py-0.5 text-xs bg-teal-500/20 text-teal-400 rounded-full flex items-center gap-1">
                                      <Star className="h-3 w-3" />
                                      Default
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-zinc-500 mt-1 space-x-3">
                                  {device.webhook_url && (
                                    <span>Webhook: {device.webhook_url.substring(0, 40)}...</span>
                                  )}
                                  {device.mac_address && (
                                    <span>MAC: {device.mac_address}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!device.is_default && (
                                <button
                                  onClick={() => handleSetDefaultDevice(device.id)}
                                  className="p-2 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700 rounded-lg transition-colors"
                                  title="Set as default"
                                >
                                  <Star className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => startEditDevice(device)}
                                className="p-2 text-zinc-400 hover:text-teal-400 hover:bg-zinc-700 rounded-lg transition-colors"
                                title="Edit device"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDevice(device.id)}
                                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded-lg transition-colors"
                                title="Delete device"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add New Device Form */}
                    {isAddingDevice && (
                      <div className="bg-zinc-800/50 rounded-xl p-4 border border-teal-500">
                        <h3 className="text-white font-medium mb-4">Add New Device</h3>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-zinc-400 mb-1">Device Name</label>
                              <input
                                type="text"
                                value={deviceForm.name}
                                onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                                placeholder="My TRMNL"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-zinc-400 mb-1">Background Color</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={deviceForm.background_color}
                                  onChange={(e) => setDeviceForm({ ...deviceForm, background_color: e.target.value })}
                                  className="w-10 h-10 rounded cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={deviceForm.background_color}
                                  onChange={(e) => setDeviceForm({ ...deviceForm, background_color: e.target.value })}
                                  className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Webhook URL</label>
                            <input
                              type="text"
                              value={deviceForm.webhook_url}
                              onChange={(e) => setDeviceForm({ ...deviceForm, webhook_url: e.target.value })}
                              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                              placeholder="https://usetrmnl.com/api/custom_plugins/..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-zinc-400 mb-1">
                                MAC Address <span className="text-teal-500">(Admin Only)</span>
                              </label>
                              <input
                                type="text"
                                value={deviceForm.mac_address}
                                onChange={(e) => setDeviceForm({ ...deviceForm, mac_address: e.target.value })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                                placeholder="AA:BB:CC:DD:EE:FF"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-zinc-400 mb-1">
                                Device API Key <span className="text-teal-500">(Admin Only)</span>
                              </label>
                              <div className="relative">
                                <input
                                  type={showApiKey ? "text" : "password"}
                                  value={deviceForm.device_api_key}
                                  onChange={(e) => setDeviceForm({ ...deviceForm, device_api_key: e.target.value })}
                                  className="w-full px-3 py-2 pr-10 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                                  placeholder="Enter device API key"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowApiKey(!showApiKey)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition-colors"
                                >
                                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={cancelDeviceEdit}
                              className="border-zinc-700 text-zinc-400"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveDevice}
                              disabled={isSavingDevice}
                              className="bg-teal-600 hover:bg-teal-700 text-white"
                            >
                              {isSavingDevice ? (
                                <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <Plus className="h-4 w-4 mr-1" />
                              )}
                              Add Device
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Add Device Button */}
                    {!isAddingDevice && !editingDevice && (
                      <Button
                        onClick={startAddDevice}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 border-dashed"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Device
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPage
