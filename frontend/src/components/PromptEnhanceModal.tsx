import { useEffect, useCallback } from "react"
import { Button } from "./ui/button"
import { Sparkles, Type, X, Loader2 } from "lucide-react"
import { useLanguage } from "../hooks/useLanguage"

interface PromptEnhanceModalProps {
  isOpen: boolean
  onClose: () => void
  originalPrompt: string
  enhancedPrompt: string
  isLoading: boolean
  onUseOriginal: () => void
  onUseEnhanced: () => void
}

export function PromptEnhanceModal({
  isOpen,
  onClose,
  originalPrompt,
  enhancedPrompt,
  isLoading,
  onUseOriginal,
  onUseEnhanced,
}: PromptEnhanceModalProps) {
  const { t } = useLanguage()

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case "Escape":
          onClose()
          break
      }
    },
    [isOpen, onClose]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {t.enhancePromptTitle || "Enhance Your Prompt?"}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Original Prompt */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Type className="w-4 h-4" />
              <span>{t.originalPrompt || "Your Prompt"}</span>
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              {originalPrompt}
            </div>
          </div>

          {/* Enhanced Prompt */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="w-4 h-4" />
              <span>{t.enhancedPrompt || "AI Enhanced"}</span>
            </div>
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm min-h-[80px]">
              {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.enhancingPrompt || "Enhancing your prompt..."}</span>
                </div>
              ) : (
                enhancedPrompt
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground">
            {t.enhanceDescription || 
              "AI enhancement adds artistic details, lighting, and style to help generate better images. Choose which version to use for generation."}
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onUseOriginal}
            disabled={isLoading}
          >
            <Type className="w-4 h-4 mr-2" />
            {t.useOriginal || "Use Original"}
          </Button>
          <Button
            className="flex-1"
            onClick={onUseEnhanced}
            disabled={isLoading || !enhancedPrompt}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {t.useEnhanced || "Use Enhanced"}
          </Button>
        </div>
      </div>
    </div>
  )
}
