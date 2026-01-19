import { useState, useRef, useEffect } from "react"
import { Sparkles, Plus, LogOut, Settings, ShoppingBag, CreditCard, Image, Menu, X, RefreshCw, Calendar, Layers } from "lucide-react"
import { Button } from "./components/ui/button"
import { ScrollArea } from "./components/ui/scroll-area"
import { ChatMessage } from "./components/ChatMessage"
import { ChatInput } from "./components/ChatInput"
import { ThemeToggle } from "./components/ThemeToggle"
import { LanguageToggle } from "./components/LanguageToggle"
import { AuthGuard } from "./components/AuthGuard"
import { LoginPage } from "./pages/LoginPage"
import { RegisterPage } from "./pages/RegisterPage"
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage"
import { ResetPasswordPage } from "./pages/ResetPasswordPage"
import { SettingsPage } from "./pages/SettingsPage"
import { PurchasePage } from "./pages/PurchasePage"
import { OrderConfirmationPage } from "./pages/OrderConfirmationPage"
import { OrdersPage } from "./pages/OrdersPage"
import { SubscriptionPage } from "./pages/SubscriptionPage"
import { GalleryPage } from "./pages/GalleryPage"
import { SchedulePage } from "./pages/SchedulePage"
import BatchPage from "./pages/BatchPage"
import { useImageGeneration, type ImageStylePreset } from "./hooks/useImageGeneration"
import { useTheme } from "./hooks/useTheme"
import { useLanguage } from "./hooks/useLanguage"
import { useTrmnlSync } from "./hooks/useTrmnlSync"
import { useAuth } from "./hooks/useAuth"
import { useSubscription } from "./hooks/useSubscription"
import { useSuggestions } from "./hooks/useSuggestions"

interface Message {
  id: string
  type: "user" | "assistant"
  content: string
  imageUrl?: string
  isLoading?: boolean
}

type AuthPage = "login" | "register" | "forgot-password" | "reset-password"
type AppPage = "chat" | "settings" | "purchase" | "order-confirmation" | "orders" | "subscription" | "gallery" | "schedule" | "batch"
type ImageSize = "1024x1024" | "1792x1024" | "1024x1792"

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [authPage, setAuthPage] = useState<AuthPage>("login")
  const [appPage, setAppPage] = useState<AppPage>("chat")
  const [confirmationOrderId, setConfirmationOrderId] = useState<number | null>(null)
  const [isFirstOrder, setIsFirstOrder] = useState(false)
  const [hasSkippedPurchase, setHasSkippedPurchase] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedSize, setSelectedSize] = useState<ImageSize>("1024x1024")
  const [selectedStyle, setSelectedStyle] = useState<ImageStylePreset>("none")
  const [resetToken, setResetToken] = useState<string>("")
  const { generateImage, isLoading } = useImageGeneration()
  const { theme, themeMode, toggleTheme } = useTheme()
  const { language, toggleLanguage, t } = useLanguage()
  const { syncToTrmnl } = useTrmnlSync()
  const { user, isLoading: authLoading, isAuthenticated, login, register, logout, getAuthHeader } = useAuth()
  const { subscription, isLoading: subscriptionLoading, needsToPurchase, needsToReactivate, hasFullAccess } = useSubscription()
  const { suggestions, isLoading: suggestionsLoading, refresh: refreshSuggestions } = useSuggestions(language)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Check if user needs to be redirected to purchase page
  useEffect(() => {
    if (isAuthenticated && !subscriptionLoading && subscription) {
      // If user hasn't purchased yet and hasn't skipped, redirect to purchase
      if (needsToPurchase() && appPage === "chat" && !hasSkippedPurchase) {
        setAppPage("purchase")
      }
      // If user needs to reactivate, they can still view the chat but will see a banner
    }
  }, [isAuthenticated, subscriptionLoading, subscription, needsToPurchase, appPage, hasSkippedPurchase])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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

  // Check for reset token in URL on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    const path = window.location.pathname

    // Handle reset-password path (with or without leading slashes)
    if (path.includes('reset-password') && token) {
      setResetToken(token)
      setAuthPage('reset-password')
      // Clean up URL
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const handleSend = async (prompt: string, imageFile?: File) => {
    const userMessageId = Date.now().toString()
    const assistantMessageId = (Date.now() + 1).toString()

    // Create user message with optional image preview
    let userContent = prompt
    let userImageUrl: string | undefined

    if (imageFile) {
      userImageUrl = URL.createObjectURL(imageFile)
      userContent = `[Image attached] ${prompt}`
    }

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, type: "user", content: userContent, imageUrl: userImageUrl },
    ])

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        type: "assistant",
        content: imageFile ? t.editingImage || "Editing image..." : t.generatingImage,
        isLoading: true,
      },
    ])

    try {
      let result
      if (imageFile) {
        // Use image edit API
        const formData = new FormData()
        formData.append("image", imageFile)
        formData.append("prompt", prompt)
        formData.append("size", selectedSize)

        const response = await fetch("/api/images/edit", {
          method: "POST",
          headers: getAuthHeader(),
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to edit image")
        }

        result = await response.json()
      } else {
        // Use regular image generation
        console.log("Generating image with size:", selectedSize, "style:", selectedStyle)
        result = await generateImage({ prompt, language, authHeaders: getAuthHeader(), size: selectedSize, stylePreset: selectedStyle })
      }

      const imageUrl = result.data[0]?.url
      const revisedPrompt = result.data[0]?.revised_prompt

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: revisedPrompt || t.defaultImageMessage,
                imageUrl,
                isLoading: false,
              }
            : msg
        )
      )
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `${t.errorPrefix} ${error instanceof Error ? error.message : "Failed to generate image"}`,
                isLoading: false,
              }
            : msg
        )
      )
    }
  }

  const handleNewChat = () => {
    setMessages([])
  }

  const handleLogin = async (email: string, password: string) => {
    return await login({ email, password })
  }

  const handleRegister = async (email: string, password: string, name?: string) => {
    return await register({ email, password, name })
  }

  const handleForgotPassword = async (email: string) => {
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to send reset email' }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  }

  const handleResetPassword = async (token: string, newPassword: string) => {
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      const data = await response.json()
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to reset password' }
      }
      // After successful reset, go to login page
      setAuthPage('login')
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  }

  const handleSyncWithAuth = async (imageUrl: string, prompt?: string) => {
    return await syncToTrmnl(imageUrl, prompt, getAuthHeader())
  }

  const handleOrderSuccess = (orderId: number, isFirst: boolean) => {
    console.log("[App] handleOrderSuccess called:", { orderId, isFirst })
    setConfirmationOrderId(orderId)
    setIsFirstOrder(isFirst)
    setAppPage("order-confirmation")
  }

  // Auth pages rendering
  const renderAuthPage = () => {
    if (authPage === "login") {
      return (
        <LoginPage
          onLogin={handleLogin}
          onSwitchToRegister={() => setAuthPage("register")}
          onForgotPassword={() => setAuthPage("forgot-password")}
          translations={t.auth.login}
        />
      )
    }
    if (authPage === "forgot-password") {
      return (
        <ForgotPasswordPage
          onSubmit={handleForgotPassword}
          onBackToLogin={() => setAuthPage("login")}
          translations={t.auth.forgotPassword}
        />
      )
    }
    if (authPage === "reset-password") {
      return (
        <ResetPasswordPage
          token={resetToken}
          onSubmit={handleResetPassword}
          onBackToLogin={() => {
            setResetToken("")
            setAuthPage("login")
          }}
          translations={t.auth.resetPassword}
        />
      )
    }
    return (
      <RegisterPage
        onRegister={handleRegister}
        onSwitchToLogin={() => setAuthPage("login")}
        translations={t.auth.register}
      />
    )
  }

  // Main chat app
  const renderChatApp = () => (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="safe-area-top sticky top-0 z-50 flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewChat}
            className="h-9 w-9 shrink-0"
            aria-label={t.newChat}
          >
            <Plus className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
            </div>
            <span className="font-semibold text-base sm:text-lg hidden xs:inline">{t.appName}</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* User info - desktop only */}
          {user && (
            <span className="text-xs text-muted-foreground mr-2 hidden sm:inline truncate max-w-[120px]">
              {user.name || user.email}
            </span>
          )}
          <LanguageToggle language={language} onToggle={toggleLanguage} />
          <ThemeToggle theme={theme} themeMode={themeMode} onToggle={toggleTheme} />

          {/* Desktop nav icons */}
          <div className="hidden sm:flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAppPage("gallery")}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Gallery"
              title={t.gallery.title}
            >
              <Image className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAppPage("schedule")}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Schedule"
              title={t.schedule?.title || "Schedule"}
            >
              <Calendar className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAppPage("batch")}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Batch"
              title={t.batch?.title || "Batch"}
            >
              <Layers className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAppPage("orders")}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Orders"
              title="My Orders"
            >
              <ShoppingBag className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAppPage("subscription")}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Subscription"
              title="Subscription"
            >
              <CreditCard className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAppPage("settings")}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={t.settings.title}
              title={t.settings.title}
            >
              <Settings className="h-4 w-4" />
            </Button>
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
                <button
                  onClick={() => { setAppPage("gallery"); setMobileMenuOpen(false) }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                >
                  <Image className="h-4 w-4" />
                  {t.gallery.title}
                </button>
                <button
                  onClick={() => { setAppPage("schedule"); setMobileMenuOpen(false) }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                >
                  <Calendar className="h-4 w-4" />
                  {t.schedule?.title || "Schedule"}
                </button>
                <button
                  onClick={() => { setAppPage("batch"); setMobileMenuOpen(false) }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                >
                  <Layers className="h-4 w-4" />
                  {t.batch?.title || "Batch"}
                </button>
                <button
                  onClick={() => { setAppPage("orders"); setMobileMenuOpen(false) }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {t.orders.title}
                </button>
                <button
                  onClick={() => { setAppPage("subscription"); setMobileMenuOpen(false) }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                >
                  <CreditCard className="h-4 w-4" />
                  {t.subscription.title}
                </button>
                <button
                  onClick={() => { setAppPage("settings"); setMobileMenuOpen(false) }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  {t.settings.title}
                </button>
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

      {/* Reactivation Banner */}
      {needsToReactivate() && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-yellow-500" />
            <span className="text-yellow-200">
              Your subscription has expired. Reactivate to continue generating images.
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => setAppPage("subscription")}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-medium"
          >
            Reactivate
          </Button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto scroll-touch">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-3 sm:px-4 py-4">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mb-4 sm:mb-6 shadow-lg">
              <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold mb-2 text-center">{t.welcome}</h1>
            <p className="text-muted-foreground text-center text-sm sm:text-base max-w-md mb-6 sm:mb-8 px-2">
              {t.welcomeSubtitle}
            </p>
            <div className="relative max-w-2xl w-full">
              <button
                onClick={refreshSuggestions}
                disabled={suggestionsLoading}
                className="absolute -top-8 right-1 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50"
                title={t.refreshSuggestions}
              >
                <RefreshCw className={`h-4 w-4 ${suggestionsLoading ? 'animate-spin' : ''}`} />
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 overflow-y-auto max-h-[40vh] sm:max-h-none px-1">
                {(suggestions.length > 0 ? suggestions : t.suggestions).map((suggestion, index) => (
                  <button
                    key={`${suggestion}-${index}`}
                    onClick={() => handleSend(suggestion)}
                    disabled={suggestionsLoading}
                    className="p-3 sm:p-4 text-left text-xs sm:text-sm rounded-xl border bg-secondary/30 hover:bg-secondary/60 active:bg-secondary/80 transition-colors touch-manipulation disabled:opacity-50"
                  >
                    {suggestionsLoading ? (
                      <span className="inline-block w-full h-4 bg-muted animate-pulse rounded" />
                    ) : (
                      suggestion
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea ref={scrollRef} className="h-full">
            <div className="pb-32">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  type={message.type}
                  content={message.content}
                  imageUrl={message.imageUrl}
                  isLoading={message.isLoading}
                  userLabel={t.you}
                  assistantLabel={t.assistant}
                  generatingText={t.generatingImage}
                  openFullSizeText={t.openFullSize}
                  syncText={t.syncToTrmnl}
                  syncingText={t.syncing}
                  syncSuccessText={t.syncSuccess}
                  shareText={t.share}
                  sharingText={t.sharing}
                  shareSuccessText={t.shareSuccess}
                  copyLinkText={t.copyLink}
                  copiedText={t.copied}
                  closeText={t.close}
                  authHeaders={getAuthHeader()}
                  onSync={handleSyncWithAuth}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </main>

      {/* Input Area */}
      <div className="safe-area-bottom sticky bottom-0 z-10 bg-gradient-to-t from-background via-background to-transparent pt-4 sm:pt-6 pb-2">
        {/* Size & Style Selectors */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-2 px-4">
          {/* Size Selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">{t.imageSize}:</span>
            <button
              onClick={() => setSelectedSize("1024x1024")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
                selectedSize === "1024x1024"
                  ? "bg-teal-500 text-white ring-2 ring-teal-500/50"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              }`}
              title={t.sizeSquare}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <rect x="2" y="2" width="12" height="12" rx="1" />
              </svg>
              <span className="hidden sm:inline">{t.sizeSquare}</span>
            </button>
            <button
              onClick={() => setSelectedSize("1792x1024")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
                selectedSize === "1792x1024"
                  ? "bg-teal-500 text-white ring-2 ring-teal-500/50"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              }`}
              title={t.sizeLandscape}
            >
              <svg className="w-4 h-3" viewBox="0 0 16 10" fill="currentColor">
                <rect x="1" y="1" width="14" height="8" rx="1" />
              </svg>
              <span className="hidden sm:inline">{t.sizeLandscape}</span>
            </button>
            <button
              onClick={() => setSelectedSize("1024x1792")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
                selectedSize === "1024x1792"
                  ? "bg-teal-500 text-white ring-2 ring-teal-500/50"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              }`}
              title={t.sizePortrait}
            >
              <svg className="w-2.5 h-4" viewBox="0 0 10 16" fill="currentColor">
                <rect x="1" y="1" width="8" height="14" rx="1" />
              </svg>
              <span className="hidden sm:inline">{t.sizePortrait}</span>
            </button>
          </div>

          {/* Style Preset Selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">{t.imageStyle}:</span>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value as ImageStylePreset)}
              className="px-2 py-1 rounded-md text-xs bg-secondary/50 text-foreground border-none outline-none cursor-pointer hover:bg-secondary transition-all"
            >
              <option value="none">{t.styleNone}</option>
              <option value="photorealistic">{t.stylePhotorealistic}</option>
              <option value="anime">{t.styleAnime}</option>
              <option value="watercolor">{t.styleWatercolor}</option>
              <option value="oil-painting">{t.styleOilPainting}</option>
              <option value="pixel-art">{t.stylePixelArt}</option>
              <option value="3d-render">{t.style3DRender}</option>
              <option value="sketch">{t.styleSketch}</option>
              <option value="pop-art">{t.stylePopArt}</option>
              <option value="minimalist">{t.styleMinimalist}</option>
              <option value="cinematic">{t.styleCinematic}</option>
            </select>
          </div>
        </div>
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          language={language}
          placeholder={t.placeholder}
          placeholderListening={t.placeholderListening}
          footer={t.footer}
        />
      </div>
    </div>
  )

  // Settings page rendering
  const renderSettingsPage = () => (
    <SettingsPage
      userId={user?.id || 0}
      authHeaders={getAuthHeader()}
      onNavigate={(page) => setAppPage(page)}
      onLogout={logout}
      translations={t.settings}
    />
  )

  // Purchase page rendering
  const renderPurchasePage = () => (
    <PurchasePage
      authHeaders={getAuthHeader()}
      onSuccess={handleOrderSuccess}
      onNavigate={hasFullAccess() ? (page) => setAppPage(page) : undefined}
      onSkip={() => {
        setHasSkippedPurchase(true)
        setAppPage("chat")
      }}
      onLogout={logout}
    />
  )

  // Order confirmation page rendering
  const renderOrderConfirmationPage = () => {
    console.log("[App] renderOrderConfirmationPage:", { confirmationOrderId, isFirstOrder })
    if (!confirmationOrderId) {
      console.log("[App] No confirmationOrderId, redirecting to chat")
      setAppPage("chat")
      return null
    }
    return (
      <OrderConfirmationPage
        orderId={confirmationOrderId}
        authHeaders={getAuthHeader()}
        onViewOrders={() => setAppPage("orders")}
        onStartCreating={() => {
          setConfirmationOrderId(null)
          setIsFirstOrder(false)
          setAppPage("chat")
        }}
        isFirstOrder={isFirstOrder}
      />
    )
  }

  // Orders page rendering
  const renderOrdersPage = () => (
    <OrdersPage
      authHeaders={getAuthHeader()}
      onNavigate={(page) => setAppPage(page)}
      onOrderMore={() => setAppPage("purchase")}
      onLogout={logout}
    />
  )

  // Subscription page rendering
  const renderSubscriptionPage = () => (
    <SubscriptionPage
      authHeaders={getAuthHeader()}
      onNavigate={(page) => setAppPage(page)}
      onLogout={logout}
    />
  )

  // Gallery page rendering
  const renderGalleryPage = () => (
    <GalleryPage onNavigate={(page) => setAppPage(page)} onLogout={logout} />
  )

  // Schedule page rendering
  const renderSchedulePage = () => (
    <SchedulePage onNavigate={(page) => setAppPage(page)} onLogout={logout} />
  )

  // Batch page rendering
  const renderBatchPage = () => (
    <BatchPage onNavigate={(page) => setAppPage(page)} onLogout={logout} />
  )

  const renderCurrentPage = () => {
    switch (appPage) {
      case "settings":
        return renderSettingsPage()
      case "purchase":
        return renderPurchasePage()
      case "order-confirmation":
        return renderOrderConfirmationPage()
      case "orders":
        return renderOrdersPage()
      case "subscription":
        return renderSubscriptionPage()
      case "gallery":
        return renderGalleryPage()
      case "schedule":
        return renderSchedulePage()
      case "batch":
        return renderBatchPage()
      case "chat":
      default:
        return renderChatApp()
    }
  }

  return (
    <AuthGuard
      isAuthenticated={isAuthenticated}
      isLoading={authLoading}
      fallback={renderAuthPage()}
      forceShowFallback={authPage === 'reset-password' || authPage === 'forgot-password'}
    >
      {renderCurrentPage()}
    </AuthGuard>
  )
}
