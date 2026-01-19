import { useState } from "react"
import { Share2, Twitter, Facebook, Linkedin, Send, Link, Check, Loader2, X, MessageCircle } from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "../lib/utils"

interface ShareButtonProps {
  imageUrl: string
  prompt?: string
  authHeaders: { Authorization?: string }
  shareText: string
  sharingText: string
  shareSuccessText: string
  copyLinkText: string
  copiedText: string
  closeText: string
  className?: string
}

interface SocialLinks {
  twitter: string
  facebook: string
  linkedin: string
  pinterest: string
  whatsapp: string
  telegram: string
}

interface ShareResponse {
  success: boolean
  shareId: string
  shareUrl: string
  imageUrl: string
  socialLinks: SocialLinks
}

export function ShareButton({
  imageUrl,
  prompt,
  authHeaders,
  shareText,
  sharingText,
  shareSuccessText,
  copyLinkText,
  copiedText,
  closeText,
  className,
}: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false)
  const [shareData, setShareData] = useState<ShareResponse | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleShare = async () => {
    if (shareData) {
      setShowMenu(true)
      return
    }

    setIsSharing(true)
    setError(null)

    try {
      const response = await fetch("/api/share/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          imageUrl,
          prompt,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create share link")
      }

      setShareData(data)
      setShowMenu(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share")
      console.error("Share error:", err)
    } finally {
      setIsSharing(false)
    }
  }

  const handleCopyLink = async () => {
    if (!shareData) return

    try {
      await navigator.clipboard.writeText(shareData.shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Copy failed:", err)
    }
  }

  const openSocialLink = (url: string) => {
    window.open(url, "_blank", "width=600,height=400")
  }

  const socialButtons = shareData ? [
    { icon: Twitter, label: "Twitter", url: shareData.socialLinks.twitter, color: "hover:bg-[#1DA1F2]/20 hover:text-[#1DA1F2]" },
    { icon: Facebook, label: "Facebook", url: shareData.socialLinks.facebook, color: "hover:bg-[#4267B2]/20 hover:text-[#4267B2]" },
    { icon: Linkedin, label: "LinkedIn", url: shareData.socialLinks.linkedin, color: "hover:bg-[#0077B5]/20 hover:text-[#0077B5]" },
    { icon: MessageCircle, label: "WhatsApp", url: shareData.socialLinks.whatsapp, color: "hover:bg-[#25D366]/20 hover:text-[#25D366]" },
    { icon: Send, label: "Telegram", url: shareData.socialLinks.telegram, color: "hover:bg-[#0088cc]/20 hover:text-[#0088cc]" },
  ] : []

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleShare}
        disabled={isSharing}
        className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-8 touch-manipulation w-full"
      >
        {isSharing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        <span className="hidden xs:inline">
          {isSharing ? sharingText : shareData ? shareSuccessText : shareText}
        </span>
        <span className="xs:hidden">
          {isSharing ? "..." : "Share"}
        </span>
      </Button>

      {/* Share Menu Popup */}
      {showMenu && shareData && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100] bg-black/50"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu - always fixed center for consistency across all contexts */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-popover border border-border rounded-lg shadow-xl p-4 w-[280px] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">{shareText}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowMenu(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Social buttons */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {socialButtons.map(({ icon: Icon, label, url, color }) => (
                <button
                  key={label}
                  onClick={() => openSocialLink(url)}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-lg transition-colors",
                    "text-muted-foreground",
                    color
                  )}
                  title={label}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] mt-1">{label}</span>
                </button>
              ))}
            </div>

            {/* Copy link */}
            <div className="flex gap-2">
              <input
                type="text"
                value={shareData.shareUrl}
                readOnly
                className="flex-1 text-xs bg-muted px-2 py-1.5 rounded border border-border truncate"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyLink}
                className={cn(
                  "h-8 px-3",
                  copied && "bg-green-500 hover:bg-green-600 text-white"
                )}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {copiedText}
                  </>
                ) : (
                  <>
                    <Link className="h-3.5 w-3.5 mr-1" />
                    {copyLinkText}
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Error Toast */}
      {error && (
        <div className="absolute bottom-full mb-2 left-0 z-50 bg-destructive text-destructive-foreground px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
