import { ReactNode } from "react"
import { Sparkles, Loader2 } from "lucide-react"

interface AuthGuardProps {
  isAuthenticated: boolean
  isLoading: boolean
  children: ReactNode
  fallback: ReactNode
  forceShowFallback?: boolean
}

export function AuthGuard({ isAuthenticated, isLoading, children, fallback, forceShowFallback }: AuthGuardProps) {
  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/25 animate-pulse">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  // Force show fallback (e.g., for password reset even when authenticated)
  if (forceShowFallback) {
    return <>{fallback}</>
  }

  // Show protected content if authenticated
  if (isAuthenticated) {
    return <>{children}</>
  }

  // Show fallback (login/register pages) if not authenticated
  return <>{fallback}</>
}
