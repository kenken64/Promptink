import { useState, memo } from "react"
import { Card } from "./ui/card"
import { Button } from "./ui/button"
import { GalleryImage } from "../hooks/useGallery"
import { useLanguage } from "../hooks/useLanguage"

// Fallback placeholder component
function ImagePlaceholder() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-muted-foreground">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1}
        stroke="currentColor"
        className="w-12 h-12 mb-2 opacity-50"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
        />
      </svg>
      <span className="text-xs">Image unavailable</span>
    </div>
  )
}

interface GalleryCardProps {
  image: GalleryImage
  onSelect: (image: GalleryImage) => void
  onToggleFavorite: (imageId: number) => Promise<boolean>
  onDelete: (imageId: number) => Promise<boolean>
}

export const GalleryCard = memo(function GalleryCard({
  image,
  onSelect,
  onToggleFavorite,
  onDelete,
}: GalleryCardProps) {
  const { t } = useLanguage()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isFavoriting, setIsFavoriting] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [imageError, setImageError] = useState(false)

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isFavoriting) return

    setIsFavoriting(true)
    try {
      await onToggleFavorite(image.id)
    } catch (err) {
      console.error("Failed to toggle favorite:", err)
    } finally {
      setIsFavoriting(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDeleting) return

    if (!confirm(t.gallery.confirmDelete)) return

    setIsDeleting(true)
    try {
      await onDelete(image.id)
    } catch (err) {
      console.error("Failed to delete:", err)
      setIsDeleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <Card
      className="group relative overflow-hidden cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
      onClick={() => onSelect(image)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Image */}
      <div className="aspect-square overflow-hidden bg-muted">
        {imageError ? (
          <ImagePlaceholder />
        ) : (
          <img
            src={image.thumbnailUrl || image.imageUrl}
            alt={image.originalPrompt}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
            decoding="async"
            width={300}
            height={300}
            onError={() => setImageError(true)}
          />
        )}
      </div>

      {/* Favorite badge */}
      {image.isFavorite && (
        <div className="absolute top-2 left-2 bg-yellow-500 text-white rounded-full p-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      {/* Edit badge */}
      {image.isEdit && (
        <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
          {t.gallery.edited}
        </div>
      )}

      {/* Actions overlay */}
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 flex flex-col justify-between p-3 ${
          showActions ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Top actions */}
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 bg-white/10 hover:bg-white/20 text-white"
            onClick={handleFavorite}
            disabled={isFavoriting}
          >
            {image.isFavorite ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4 text-yellow-400"
              >
                <path
                  fillRule="evenodd"
                  d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 bg-white/10 hover:bg-red-500/80 text-white"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </Button>
        </div>

        {/* Bottom info */}
        <div className="text-white">
          <p className="text-sm line-clamp-2 mb-1">{image.originalPrompt}</p>
          <div className="flex items-center gap-2 text-xs text-white/70">
            <span>{image.size}</span>
            <span>•</span>
            <span>{formatDate(image.createdAt)}</span>
          </div>
        </div>
      </div>
    </Card>
  )
})
