import { ReactNode } from "react"
import { Sparkles, LogOut, Settings, Image, Calendar, Layers, ShoppingBag, CreditCard, Menu, X } from "lucide-react"
import { Button } from "./ui/button"
import { ThemeToggle } from "./ThemeToggle"
import { LanguageToggle } from "./LanguageToggle"
import { useLanguage } from "../hooks/useLanguage"
import { useTheme } from "../hooks/useTheme"
import { useAuth } from "../hooks/useAuth"
import { useState, useEffect } from "react"

export interface PageHeaderProps {
  title?: string
  onNavigate: (page: "chat" | "gallery" | "schedule" | "batch" | "orders" | "subscription" | "settings") => void
  currentPage?: string
  rightContent?: ReactNode
  onLogout?: () => void
}

export function PageHeader({ title, onNavigate, currentPage, rightContent, onLogout }: PageHeaderProps) {
  const { language, toggleLanguage, t } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const { user, logout: hookLogout } = useAuth()
  
  // Use provided onLogout or fall back to hook logout
  const logout = onLogout || hookLogout
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuOpen) {
        const target = e.target as HTMLElement
        if (!target.closest('.mobile-menu-container')) {
          setMobileMenuOpen(false)
        }
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [mobileMenuOpen])

  const navItems = [
    { page: "gallery" as const, icon: Image, label: t.gallery?.title || "Gallery" },
    { page: "schedule" as const, icon: Calendar, label: t.schedule?.title || "Schedule" },
    { page: "batch" as const, icon: Layers, label: t.batch?.title || "Batch" },
    { page: "orders" as const, icon: ShoppingBag, label: t.orders?.title || "Orders" },
    { page: "subscription" as const, icon: CreditCard, label: t.subscription?.title || "Subscription" },
    { page: "settings" as const, icon: Settings, label: t.settings?.title || "Settings" },
  ]

  return (
    <header className="safe-area-top sticky top-0 z-50 flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Logo - clickable to go home */}
        <button
          onClick={() => onNavigate("chat")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          aria-label="Go to home"
        >
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
          </div>
          <span className="font-semibold text-base sm:text-lg hidden xs:inline">{t.appName}</span>
        </button>

        {/* Page title separator */}
        {title && (
          <>
            <span className="text-muted-foreground hidden sm:inline">/</span>
            <h1 className="font-semibold text-base sm:text-lg text-foreground truncate max-w-[150px] sm:max-w-none">
              {title}
            </h1>
          </>
        )}
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1">
        {/* User info - desktop only */}
        {user && (
          <span className="text-xs text-muted-foreground mr-2 hidden sm:inline truncate max-w-[120px]">
            {user.name || user.email}
          </span>
        )}

        {/* Right content slot (for page-specific actions) */}
        {rightContent}

        <LanguageToggle language={language} onToggle={toggleLanguage} />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />

        {/* Desktop nav icons */}
        <div className="hidden sm:flex items-center gap-0.5">
          {navItems.map(({ page, icon: Icon, label }) => (
            <Button
              key={page}
              variant="ghost"
              size="icon"
              onClick={() => onNavigate(page)}
              className={`h-9 w-9 shrink-0 ${
                currentPage === page 
                  ? "text-foreground bg-muted" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={label}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t.logout}
            title={t.logout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile menu button */}
        <div className="relative sm:hidden mobile-menu-container">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              setMobileMenuOpen(!mobileMenuOpen)
            }}
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Mobile dropdown menu */}
          {mobileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-background border border-border rounded-lg shadow-lg py-1 z-50">
              {/* Home option at top */}
              <button
                onClick={() => { onNavigate("chat"); setMobileMenuOpen(false) }}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-muted transition-colors font-medium"
              >
                <Sparkles className="h-4 w-4" />
                {t.appName}
              </button>
              <div className="border-t border-border my-1" />
              {navItems.map(({ page, icon: Icon, label }) => (
                <button
                  key={page}
                  onClick={() => { onNavigate(page); setMobileMenuOpen(false) }}
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-muted transition-colors ${
                    currentPage === page ? "bg-muted font-medium" : ""
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { logout(); setMobileMenuOpen(false) }}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-muted transition-colors text-red-500"
              >
                <LogOut className="h-4 w-4" />
                {t.logout}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
