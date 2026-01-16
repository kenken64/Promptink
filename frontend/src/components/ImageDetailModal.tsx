import { useEffect, useCallback, useState } from "react"
import { Button } from "./ui/button"
import { GalleryImage } from "../hooks/useGallery"
import { useLanguage } from "../hooks/useLanguage"
import { ShareButton } from "./ShareButton"

// Fallback placeholder component for modal
function ModalImagePlaceholder() {
  return (
    <div className="w-full h-64 md:h-96 flex flex-col items-center justify-center bg-muted text-muted-foreground rounded-lg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1}
        stroke="currentColor"
        className="w-16 h-16 mb-3 opacity-50"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
        />
      </svg>
      <span className="text-sm">Image unavailable</span>
    </div>
  )
}

interface ImageDetailModalProps {
  image: GalleryImage | null
  isOpen: boolean
  onClose: () => void
  onToggleFavorite: (imageId: number) => Promise<boolean>
  onDelete: (imageId: number) => Promise<boolean>
  onNavigate?: (direction: "prev" | "next") => void
  hasPrev?: boolean
  hasNext?: boolean
}

export function ImageDetailModal({
  image,
  isOpen,
  onClose,
  onToggleFavorite,
  onDelete,
  onNavigate,
  hasPrev = false,
  hasNext = false,
}: ImageDetailModalProps) {
  const { t } = useLanguage()
  const [imageError, setImageError] = useState(false)

  // Reset image error when image changes
  useEffect(() => {
    setImageError(false)
  }, [image?.id])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case "Escape":
        onClose()
        break
      case "ArrowLeft":
        if (hasPrev && onNavigate) onNavigate("prev")
        break
      case "ArrowRight":
        if (hasNext && onNavigate) onNavigate("next")
        break
    }
  }, [isOpen, onClose, onNavigate, hasPrev, hasNext])

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

  if (!isOpen || !image) return null

  const handleDownload = async () => {
    try {
      const response = await fetch(image.imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `promptink-${image.id}-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Download failed:", err)
    }
  }

  const handleFavorite = async () => {
    try {
      await onToggleFavorite(image.id)
    } catch (err) {
      console.error("Failed to toggle favorite:", err)
    }
  }

  const handleDelete = async () => {
    if (!confirm(t.gallery.confirmDelete)) return
    try {
      await onDelete(image.id)
      onClose()
    } catch (err) {
      console.error("Failed to delete:", err)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Navigation arrows */}
      {hasPrev && onNavigate && (
        <button
          className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={() => onNavigate("prev")}
          aria-label={t.gallery.previous}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>
      )}
      {hasNext && onNavigate && (
        <button
          className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={() => onNavigate("next")}
          aria-label={t.gallery.next}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
      )}

      {/* Modal content */}
      <div className="relative z-10 max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col md:flex-row bg-background rounded-lg shadow-2xl">
        {/* Close button */}
        <button
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          onClick={onClose}
          aria-label={t.gallery.close}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Image section */}
        <div className="flex-1 flex items-center justify-center bg-black/20 p-4 min-h-[300px]">
          {imageError ? (
            <ModalImagePlaceholder />
          ) : (
            <img
              src={image.imageUrl}
              alt={image.originalPrompt}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
              onError={() => setImageError(true)}
            />
          )}
        </div>

        {/* Info section */}
        <div className="w-full md:w-80 flex flex-col border-l border-border overflow-y-auto">
          {/* Badges */}
          <div className="flex items-center gap-2 p-4 border-b border-border">
            {image.isFavorite && (
              <span className="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs px-2 py-1 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-3 h-3"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                    clipRule="evenodd"
                  />
                </svg>
                {t.gallery.favorite}
              </span>
            )}
            {image.isEdit && (
              <span className="bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs px-2 py-1 rounded-full">
                {t.gallery.edited}
              </span>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 p-4 space-y-4">
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                {t.gallery.prompt}
              </h3>
              <p className="text-sm">{image.originalPrompt}</p>
            </div>

            {image.revisedPrompt && image.revisedPrompt !== image.originalPrompt && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {t.gallery.revisedPrompt}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {image.revisedPrompt}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {t.gallery.model}
                </h3>
                <p className="text-sm">{image.model}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {t.gallery.size}
                </h3>
                <p className="text-sm">{image.size}</p>
              </div>
            </div>

            {image.style && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {t.gallery.style}
                </h3>
                <p className="text-sm capitalize">{image.style}</p>
              </div>
            )}

            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                {t.gallery.created}
              </h3>
              <p className="text-sm">{formatDate(image.createdAt)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-border space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleFavorite}
              >
                {image.isFavorite ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4 mr-1 text-yellow-500"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {t.gallery.unfavorite}
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4 mr-1"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                      />
                    </svg>
                    {t.gallery.addFavorite}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleDownload}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4 mr-1"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                {t.gallery.download}
              </Button>
            </div>

            <div className="flex gap-2">
              <ShareButton
                imageUrl={image.imageUrl}
                prompt={image.originalPrompt}
                className="flex-1"
              />
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={handleDelete}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4 mr-1"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
                {t.gallery.delete}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
