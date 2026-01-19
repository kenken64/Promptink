import { useState, useEffect } from "react"
import { Lock, RefreshCw, Users, Image, CreditCard, Crown } from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"

interface AdminStats {
  totalUsers: number
  totalImages: number
  paidOrders: number
  activeSubscriptions: number
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

  const handleRefresh = () => {
    if (token) {
      setStats(null)
      setTimeout(() => fetchStats(token), 100)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("admin_token")
    setToken(null)
    setIsAuthenticated(false)
    setStats(null)
    setPassword("")
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

          <form onSubmit={handleLogin} className="space-y-4">
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
    </div>
  )
}

export default AdminPage
