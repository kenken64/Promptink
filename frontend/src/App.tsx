import { useState, useRef, useEffect } from "react"
import { Sparkles, Plus, LogOut, Settings } from "lucide-react"
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
import { useImageGeneration } from "./hooks/useImageGeneration"
import { useTheme } from "./hooks/useTheme"
import { useLanguage } from "./hooks/useLanguage"
import { useTrmnlSync } from "./hooks/useTrmnlSync"
import { useAuth } from "./hooks/useAuth"

interface Message {
  id: string
  type: "user" | "assistant"
  content: string
  imageUrl?: string
  isLoading?: boolean
}

type AuthPage = "login" | "register"
type AppPage = "chat" | "settings"

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [authPage, setAuthPage] = useState<AuthPage>("login")
  const [appPage, setAppPage] = useState<AppPage>("chat")
  const { generateImage, isLoading } = useImageGeneration()
  const { theme, toggleTheme } = useTheme()
  const { language, toggleLanguage, t } = useLanguage()
  const { syncToTrmnl } = useTrmnlSync()
  const { user, isLoading: authLoading, isAuthenticated, login, register, logout, getAuthHeader } = useAuth()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (prompt: string) => {
    const userMessageId = Date.now().toString()
    const assistantMessageId = (Date.now() + 1).toString()

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, type: "user", content: prompt },
    ])

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        type: "assistant",
        content: t.generatingImage,
        isLoading: true,
      },
    ])

    try {
      const result = await generateImage({ prompt, language, authHeaders: getAuthHeader() })
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

  return (
    <AuthGuard
      isAuthenticated={isAuthenticated}
      isLoading={authLoading}
      fallback={renderAuthPage()}
    >
      {appPage === "settings" ? renderSettingsPage() : renderChatApp()}
    </AuthGuard>
  )
}
