import { User, Sparkles, Copy, Check, Download, RefreshCw } from "lucide-react"
import { useState } from "react"
import { cn } from "../lib/utils"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Button } from "./ui/button"
import { ShareButton } from "./ShareButton"

interface ChatMessageProps {
  type: "user" | "assistant"
  content: string
  imageUrl?: string
  isLoading?: boolean
  userLabel: string
  assistantLabel: string
  generatingText: string
  openFullSizeText: string
  syncText: string
  syncingText: string
  syncSuccessText: string
  shareText: string
  sharingText: string
  shareSuccessText: string
  copyLinkText: string
  copiedText: string
  closeText: string
  onSync?: (imageUrl: string, prompt?: string) => Promise<void>
}

export function ChatMessage({
  type,
  content,
  imageUrl,
  isLoading,
  userLabel,
  assistantLabel,
  generatingText,
  openFullSizeText,
  syncText,
  syncingText,
  syncSuccessText,
  shareText,
  sharingText,
  shareSuccessText,
  copyLinkText,
  copiedText,
  closeText,
  onSync,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (imageUrl) {
      window.open(imageUrl, "_blank")
    }
  }

  const handleSync = async () => {
    if (!imageUrl || !onSync) return

    setIsSyncing(true)
    setSyncSuccess(false)

    try {
      await onSync(imageUrl, content)
      setSyncSuccess(true)
      setTimeout(() => setSyncSuccess(false), 3000)
    } catch (error) {
      console.error("Sync failed:", error)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div
      className={cn(
        "group w-full py-4 sm:py-6",
        type === "assistant" ? "bg-transparent" : "bg-transparent"
      )}
    >
      <div className="max-w-3xl mx-auto flex gap-2 sm:gap-4 px-3 sm:px-4">
        <Avatar className={cn(
          "mt-0.5 h-8 w-8 sm:h-10 sm:w-10 shrink-0",
          type === "assistant"
            ? "bg-gradient-to-br from-teal-400 to-emerald-500"
            : "bg-gradient-to-br from-violet-500 to-purple-600"
        )}>
          <AvatarFallback className="bg-transparent text-white">
            {type === "assistant" ? (
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            ) : (
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2 sm:space-y-3 overflow-hidden min-w-0">
          <div className="font-semibold text-xs sm:text-sm">
            {type === "assistant" ? assistantLabel : userLabel}
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none">
            {isLoading ? (
              <div className="flex items-center gap-1">
                <span className="typing-cursor text-muted-foreground text-sm">{generatingText}</span>
              </div>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base break-words">{content}</p>
            )}
          </div>

          {imageUrl && (
            <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
              <div className="relative group/image inline-block max-w-full">
                <img
                  src={imageUrl}
                  alt="Generated image"
                  className="rounded-xl w-full sm:max-w-md h-auto shadow-lg"
                  loading="lazy"
                />
                {/* Desktop: show on hover. Mobile: always visible at bottom */}
                <div className="sm:absolute sm:inset-0 sm:bg-black/50 sm:opacity-0 sm:group-hover/image:opacity-100 transition-opacity sm:rounded-xl flex items-center justify-center gap-2 mt-2 sm:mt-0 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownload}
                    className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-8 touch-manipulation"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden xs:inline">{openFullSizeText}</span>
                    <span className="xs:hidden">Open</span>
                  </Button>
                  {onSync && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSync}
                      disabled={isSyncing}
                      className={cn(
                        "gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-8 touch-manipulation",
                        syncSuccess && "bg-green-500 hover:bg-green-600 text-white"
                      )}
                    >
                      <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                      <span className="hidden xs:inline">
                        {isSyncing ? syncingText : syncSuccess ? syncSuccessText : syncText}
                      </span>
                      <span className="xs:hidden">
                        {isSyncing ? "..." : syncSuccess ? "Done" : "Sync"}
                      </span>
                    </Button>
                  )}
                  <ShareButton
                    imageUrl={imageUrl}
                    prompt={content}
                    shareText={shareText}
                    sharingText={sharingText}
                    shareSuccessText={shareSuccessText}
                    copyLinkText={copyLinkText}
                    copiedText={copiedText}
                    closeText={closeText}
                  />
                </div>
              </div>
            </div>
          )}

          {!isLoading && type === "assistant" && (
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 w-8 sm:w-auto sm:px-2 text-muted-foreground hover:text-foreground touch-manipulation"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              {imageUrl && onSync && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className={cn(
                    "h-8 px-2 gap-1 touch-manipulation",
                    syncSuccess
                      ? "text-green-500 hover:text-green-600"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                  <span className="text-xs hidden sm:inline">
                    {isSyncing ? syncingText : syncSuccess ? syncSuccessText : syncText}
                  </span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
