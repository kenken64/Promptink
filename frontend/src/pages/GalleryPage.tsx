import { useState, useCallback } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { GalleryCard } from "../components/GalleryCard"
import { ImageDetailModal } from "../components/ImageDetailModal"
import { PageHeader } from "../components/PageHeader"
import { useGallery, GalleryImage } from "../hooks/useGallery"
import { useLanguage } from "../hooks/useLanguage"
import { RefreshCw } from "lucide-react"

type AppPage = "chat" | "gallery" | "schedule" | "batch" | "orders" | "subscription" | "settings"

interface GalleryPageProps {
  onNavigate: (page: AppPage) => void
}

export function GalleryPage({ onNavigate }: GalleryPageProps) {
  const { t } = useLanguage()
  const {
    images,
    pagination,
    stats,
    isLoading,
    error,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    toggleFavorite,
    deleteImage,
    loadMore,
    refresh,
  } = useGallery()

  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [localSearch, setLocalSearch] = useState("")

  const handleSelectImage = useCallback((image: GalleryImage) => {
    setSelectedImage(image)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedImage(null)
  }, [])

  const handleNavigate = useCallback((direction: "prev" | "next") => {
    if (!selectedImage) return

    const currentIndex = images.findIndex((img) => img.id === selectedImage.id)
    if (currentIndex === -1) return

    const newIndex = direction === "prev" ? currentIndex - 1 : currentIndex + 1
    if (newIndex >= 0 && newIndex < images.length) {
      setSelectedImage(images[newIndex])
    }
  }, [selectedImage, images])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(localSearch)
  }

  const clearSearch = () => {
    setLocalSearch("")
    setSearchQuery("")
  }

  const currentIndex = selectedImage
    ? images.findIndex((img) => img.id === selectedImage.id)
    : -1

  // Refresh button for header
  const refreshButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={refresh}
      disabled={isLoading}
      className="h-9 w-9 text-muted-foreground hover:text-foreground"
      title={t.gallery?.refresh || "Refresh"}
    >
      <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
    </Button>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Standardized Header */}
      <PageHeader
        title={t.gallery?.title}
        onNavigate={onNavigate}
        currentPage="gallery"
        rightContent={refreshButton}
      />

      {/* Sub-header with stats, filters & search */}
      <div className="sticky top-[57px] z-[9] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          {/* Stats */}
          {stats && (
            <p className="text-sm text-muted-foreground mb-4">
              {t.gallery?.totalImages?.replace("{count}", String(stats.total))}
              {stats.favorites > 0 && (
                <> · {t.gallery?.totalFavorites?.replace("{count}", String(stats.favorites))}</>
              )}
            </p>
          )}

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Filter tabs */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
                onClick={() => setFilter("all")}
              >
                {t.gallery?.allImages}
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-border ${
                  filter === "favorites"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
                onClick={() => setFilter("favorites")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 inline mr-1"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                    clipRule="evenodd"
                  />
                </svg>
                {t.gallery?.favorites}
              </button>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 flex gap-2 max-w-md">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder={t.gallery?.searchPlaceholder}
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pr-8"
                />
                {localSearch && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={clearSearch}
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
              <Button type="submit" size="sm">
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
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              </Button>
            </form>
          </div>

          {/* Active search indicator */}
          {searchQuery && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <span>
                {t.gallery?.searchingFor}: <strong>"{searchQuery}"</strong>
              </span>
              <button
                className="text-primary hover:underline"
                onClick={clearSearch}
              >
                {t.gallery?.clearSearch}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-7xl mx-auto px-4 py-6">
        {/* Error state */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={refresh}
            >
              {t.gallery.tryAgain}
            </Button>
          </div>
        )}

        {/* Loading state for initial load */}
        {isLoading && images.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-muted rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && images.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
                className="w-10 h-10 text-muted-foreground"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-1">
              {searchQuery
                ? t.gallery.noSearchResults
                : filter === "favorites"
                ? t.gallery.noFavorites
                : t.gallery.noImages}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {searchQuery
                ? t.gallery.tryDifferentSearch
                : filter === "favorites"
                ? t.gallery.noFavoritesHint
                : t.gallery.noImagesHint}
            </p>
            {(searchQuery || filter === "favorites") && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  clearSearch()
                  setFilter("all")
                }}
              >
                {t.gallery.viewAllImages}
              </Button>
            )}
          </div>
        )}

        {/* Image grid */}
        {images.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((image) => (
                <GalleryCard
                  key={image.id}
                  image={image}
                  onSelect={handleSelectImage}
                  onToggleFavorite={toggleFavorite}
                  onDelete={deleteImage}
                />
              ))}
            </div>

            {/* Load more */}
            {pagination?.hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      {t.gallery.loading}
                    </>
                  ) : (
                    <>
                      {t.gallery.loadMore}
                      <span className="ml-1 text-muted-foreground">
                        ({pagination.total - images.length} {t.gallery.remaining})
                      </span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Image detail modal */}
      <ImageDetailModal
        image={selectedImage}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onToggleFavorite={toggleFavorite}
        onDelete={deleteImage}
        onNavigate={handleNavigate}
        hasPrev={currentIndex > 0}
        hasNext={currentIndex < images.length - 1}
      />
    </div>
  )
}
