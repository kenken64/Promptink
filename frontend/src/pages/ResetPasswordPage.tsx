import { useState, useEffect, FormEvent } from "react"
import { Sparkles, Lock, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "../components/ui/button"
import { cn } from "../lib/utils"

interface ResetPasswordPageProps {
  token: string
  onSubmit: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  onBackToLogin: () => void
  translations: {
    title: string
    subtitle: string
    newPasswordLabel: string
    newPasswordPlaceholder: string
    confirmPasswordLabel: string
    confirmPasswordPlaceholder: string
    submitButton: string
    submitting: string
    backToLogin: string
    successTitle: string
    successMessage: string
    passwordMismatch: string
    passwordTooShort: string
    invalidToken: string
  }
}

export function ResetPasswordPage({ token, onSubmit, onBackToLogin, translations: t }: ResetPasswordPageProps) {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isInvalidToken, setIsInvalidToken] = useState(false)

  useEffect(() => {
    if (!token) {
      setIsInvalidToken(true)
    }
  }, [token])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError(t.passwordMismatch)
      return
    }

    // Validate password length
    if (newPassword.length < 8) {
      setError(t.passwordTooShort)
      return
    }

    setIsLoading(true)

    const result = await onSubmit(token, newPassword)

    if (result.success) {
      setIsSuccess(true)
    } else {
      setError(result.error || "Failed to reset password")
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="bg-card backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-teal-500/25">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {isSuccess ? t.successTitle : isInvalidToken ? t.invalidToken : t.title}
            </h1>
            {!isInvalidToken && (
              <p className="text-muted-foreground text-sm mt-1 text-center">
                {isSuccess ? t.successMessage : t.subtitle}
              </p>
            )}
          </div>

          {isInvalidToken ? (
            /* Invalid token state */
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <AlertCircle className="h-16 w-16 text-red-500" />
              </div>
              <Button
                onClick={onBackToLogin}
                className={cn(
                  "w-full py-3 rounded-xl font-semibold text-white transition-all duration-300",
                  "bg-gradient-to-r from-teal-500 to-emerald-500",
                  "hover:from-teal-400 hover:to-emerald-400",
                  "shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
                )}
              >
                {t.backToLogin}
              </Button>
            </div>
          ) : isSuccess ? (
            /* Success state */
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <CheckCircle className="h-16 w-16 text-emerald-500" />
              </div>
              <Button
                onClick={onBackToLogin}
                className={cn(
                  "w-full py-3 rounded-xl font-semibold text-white transition-all duration-300",
                  "bg-gradient-to-r from-teal-500 to-emerald-500",
                  "hover:from-teal-400 hover:to-emerald-400",
                  "shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
                )}
              >
                {t.backToLogin}
              </Button>
            </div>
          ) : (
            <>
              {/* Error message */}
              {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm text-center animate-in fade-in slide-in-from-top-2 duration-300">
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* New Password field */}
                <div className="space-y-2">
                  <label htmlFor="newPassword" className="block text-sm font-medium text-foreground">
                    {t.newPasswordLabel}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t.newPasswordPlaceholder}
                      required
                      minLength={8}
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
                      minLength={8}
                      className="w-full pl-10 pr-12 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
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
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className={cn(
                    "w-full py-3 rounded-xl font-semibold text-white transition-all duration-300",
                    "bg-gradient-to-r from-teal-500 to-emerald-500",
                    "hover:from-teal-400 hover:to-emerald-400",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
                  )}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t.submitting}
                    </span>
                  ) : (
                    t.submitButton
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
              </div>

              {/* Back to login */}
              <button
                onClick={onBackToLogin}
                className="flex items-center justify-center gap-2 w-full text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {t.backToLogin}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-muted-foreground text-xs mt-6">
          Powered by DALL-E 3 & TRMNL
        </p>
      </div>
    </div>
  )
}
