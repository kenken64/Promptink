import { useState, FormEvent } from "react"
import { Sparkles, Mail, Lock, Eye, EyeOff, Loader2, User } from "lucide-react"
import { Button } from "../components/ui/button"
import { cn } from "../lib/utils"

interface RegisterPageProps {
  onRegister: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>
  onSwitchToLogin: () => void
  translations: {
    title: string
    subtitle: string
    nameLabel: string
    namePlaceholder: string
    emailLabel: string
    emailPlaceholder: string
    passwordLabel: string
    passwordPlaceholder: string
    confirmPasswordLabel: string
    confirmPasswordPlaceholder: string
    registerButton: string
    registering: string
    hasAccount: string
    signIn: string
    passwordMismatch: string
    passwordTooShort: string
    emailAlreadyExists: string
    invalidEmail: string
    weakPassword: string
    genericError: string
  }
}

export function RegisterPage({ onRegister, onSwitchToLogin, translations: t }: RegisterPageProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Map backend error codes/messages to user-friendly translated strings
  const mapErrorMessage = (error: string): string => {
    if (error === "EMAIL_ALREADY_EXISTS") return t.emailAlreadyExists
    if (error === "Invalid email format") return t.invalidEmail
    if (error.startsWith("Password must")) return t.weakPassword
    return t.genericError
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate password match
    if (password !== confirmPassword) {
      setError(t.passwordMismatch)
      return
    }

    // Validate password length
    if (password.length < 6) {
      setError(t.passwordTooShort)
      return
    }

    setIsLoading(true)

    const result = await onRegister(email, password, name || undefined)

    if (!result.success) {
      setError(mapErrorMessage(result.error || ""))
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="bg-card backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-teal-500/25">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t.subtitle}</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm text-center animate-in fade-in slide-in-from-top-2 duration-300">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Name field */}
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-foreground">
                {t.nameLabel}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>
            </div>

            {/* Email field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                {t.emailLabel}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                {t.passwordLabel}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  required
                  className="w-full pl-10 pr-12 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password field */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                {t.confirmPasswordLabel}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t.confirmPasswordPlaceholder}
                  required
                  className={cn(
                    "w-full pl-10 pr-12 py-3 bg-muted border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all",
                    confirmPassword && password !== confirmPassword
                      ? "border-red-500/50 focus:ring-red-500/50 focus:border-red-500"
                      : "border-border focus:ring-teal-500/50 focus:border-teal-500"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={isLoading || !email || !password || !confirmPassword}
              className={cn(
                "w-full py-3 rounded-xl font-semibold text-white transition-all duration-300 mt-6",
                "bg-gradient-to-r from-teal-500 to-emerald-500",
                "hover:from-teal-400 hover:to-emerald-400",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t.registering}
                </span>
              ) : (
                t.registerButton
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
          </div>

          {/* Switch to login */}
          <p className="text-center text-muted-foreground text-sm">
            {t.hasAccount}{" "}
            <button
              onClick={onSwitchToLogin}
              className="text-teal-500 hover:text-teal-400 font-medium transition-colors"
            >
              {t.signIn}
            </button>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-muted-foreground text-xs mt-6">
          Powered by DALL-E 3 & TRMNL
        </p>
      </div>
    </div>
  )
}
