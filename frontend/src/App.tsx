import { useState, useRef, useEffect } from "react"
import { Sparkles, Plus, LogOut, Settings, ShoppingBag, CreditCard, Image } from "lucide-react"
import { Button } from "./components/ui/button"
import { ScrollArea } from "./components/ui/scroll-area"
import { ChatMessage } from "./components/ChatMessage"
import { ChatInput } from "./components/ChatInput"
import { ThemeToggle } from "./components/ThemeToggle"
import { LanguageToggle } from "./components/LanguageToggle"
import { AuthGuard } from "./components/AuthGuard"
import { LoginPage } from "./pages/LoginPage"
import { RegisterPage } from "./pages/RegisterPage"
import { SettingsPage } from "./pages/SettingsPage"
import { PurchasePage } from "./pages/PurchasePage"
import { OrderConfirmationPage } from "./pages/OrderConfirmationPage"
import { OrdersPage } from "./pages/OrdersPage"
import { SubscriptionPage } from "./pages/SubscriptionPage"
import { GalleryPage } from "./pages/GalleryPage"
import { useImageGeneration } from "./hooks/useImageGeneration"
import { useTheme } from "./hooks/useTheme"
import { useLanguage } from "./hooks/useLanguage"
import { useTrmnlSync } from "./hooks/useTrmnlSync"
import { useAuth } from "./hooks/useAuth"
import { useSubscription } from "./hooks/useSubscription"

interface Message {
  id: string
  type: "user" | "assistant"
  content: string
  imageUrl?: string
  isLoading?: boolean
}

type AuthPage = "login" | "register"
type AppPage = "chat" | "settings" | "purchase" | "order-confirmation" | "orders" | "subscription" | "gallery"

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [authPage, setAuthPage] = useState<AuthPage>("login")
  const [appPage, setAppPage] = useState<AppPage>("chat")
  const [confirmationOrderId, setConfirmationOrderId] = useState<number | null>(null)
  const [isFirstOrder, setIsFirstOrder] = useState(false)
  const [hasSkippedPurchase, setHasSkippedPurchase] = useState(false)
  const { generateImage, isLoading } = useImageGeneration()
  const { theme, toggleTheme } = useTheme()
  const { language, toggleLanguage, t } = useLanguage()
  const { syncToTrmnl } = useTrmnlSync()
  const { user, isLoading: authLoading, isAuthenticated, login, register, logout, getAuthHeader } = useAuth()
  const { subscription, isLoading: subscriptionLoading, needsToPurchase, needsToReactivate, hasFullAccess } = useSubscription()
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
        formData.append("size", "1024x1024")

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
        result = await generateImage({ prompt, language, authHeaders: getAuthHeader() })
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

  const handleSyncWithAuth = async (imageUrl: string, prompt?: string) => {
    return await syncToTrmnl(imageUrl, prompt, getAuthHeader())
  }

  const handleOrderSuccess = (orderId: number, isFirst: boolean) => {
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
          translations={t.auth.login}
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
          {/* User info */}
          {user && (
            <span className="text-xs text-muted-foreground mr-2 hidden sm:inline truncate max-w-[120px]">
              {user.name || user.email}
            </span>
          )}
          <LanguageToggle language={language} onToggle={toggleLanguage} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
      <main className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-3 sm:px-4 py-4">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mb-4 sm:mb-6 shadow-lg">
              <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold mb-2 text-center">{t.welcome}</h1>
            <p className="text-muted-foreground text-center text-sm sm:text-base max-w-md mb-6 sm:mb-8 px-2">
              {t.welcomeSubtitle}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-2xl w-full overflow-y-auto max-h-[40vh] sm:max-h-none px-1">
              {t.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="p-3 sm:p-4 text-left text-xs sm:text-sm rounded-xl border bg-secondary/30 hover:bg-secondary/60 active:bg-secondary/80 transition-colors touch-manipulation"
                >
                  {suggestion}
                </button>
              ))}
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
      <div className="safe-area-bottom sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-4 sm:pt-6">
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
      onBack={() => setAppPage("chat")}
      translations={t.settings}
    />
  )

  // Purchase page rendering
  const renderPurchasePage = () => (
    <PurchasePage
      authHeaders={getAuthHeader()}
      onSuccess={handleOrderSuccess}
      onBack={hasFullAccess() ? () => setAppPage("chat") : undefined}
      onSkip={() => {
        setHasSkippedPurchase(true)
        setAppPage("chat")
      }}
    />
  )

  // Order confirmation page rendering
  const renderOrderConfirmationPage = () => {
    if (!confirmationOrderId) {
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
      onBack={() => setAppPage("chat")}
      onOrderMore={() => setAppPage("purchase")}
    />
  )

  // Subscription page rendering
  const renderSubscriptionPage = () => (
    <SubscriptionPage
      authHeaders={getAuthHeader()}
      onBack={() => setAppPage("chat")}
    />
  )

  // Gallery page rendering
  const renderGalleryPage = () => (
    <GalleryPage />
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
    >
      {renderCurrentPage()}
    </AuthGuard>
  )
}
