import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { GalleryCard } from "../components/GalleryCard"
import { ImageDetailModal } from "../components/ImageDetailModal"
import { CollectionManager } from "../components/CollectionManager"
import { BulkActionBar } from "../components/BulkActionBar"
import { PageHeader } from "../components/PageHeader"
import { useGallery, GalleryImage, BulkShareResult } from "../hooks/useGallery"
import { useCollections } from "../hooks/useCollections"
import { useLanguage } from "../hooks/useLanguage"
import { useAuth } from "../hooks/useAuth"
import { RefreshCw, Upload, FolderOpen, Settings2, CheckSquare, X } from "lucide-react"
import { detectBrowserTimezone, groupImagesByDate } from "../utils"

type AppPage = "chat" | "gallery" | "schedule" | "batch" | "orders" | "subscription" | "settings"

interface GalleryPageProps {
  onNavigate: (page: AppPage) => void
  onLogout?: () => void
}

export function GalleryPage({ onNavigate, onLogout }: GalleryPageProps) {
  const { t, language } = useLanguage()
  const { authFetch } = useAuth()
  const {
    images,
    pagination,
    stats,
    isLoading,
    error,
    filter,
    setFilter,
    collectionId,
    setCollectionId,
    searchQuery,
    setSearchQuery,
    toggleFavorite,
    deleteImage,
    uploadImage,
    loadMore,
    refresh,
    isSelectMode,
    selectedIds,
    toggleSelect,
    selectAll,
    deselectAll,
    enterSelectMode,
    exitSelectMode,
    bulkDelete,
    bulkExport,
    bulkShare,
  } = useGallery()
  const { collections, refresh: refreshCollections } = useCollections()

  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [localSearch, setLocalSearch] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showCollectionManager, setShowCollectionManager] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isBulkExporting, setIsBulkExporting] = useState(false)
  const [isBulkSharing, setIsBulkSharing] = useState(false)
  const [shareResult, setShareResult] = useState<BulkShareResult | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [userTimezone, setUserTimezone] = useState<string>(() => detectBrowserTimezone())

  // Fetch user's saved timezone (only use if explicitly set, not default UTC)
  useEffect(() => {
    const fetchTimezone = async () => {
      try {
        const response = await authFetch("/api/settings")
        if (response.ok) {
          const data = await response.json()
          // Only use saved timezone if it's not the default UTC
          // This allows browser timezone to be used for users who haven't set a preference
          if (data.timezone && data.timezone !== "UTC") {
            setUserTimezone(data.timezone)
          }
        }
      } catch (error) {
        console.error("Failed to fetch timezone:", error)
      }
    }
    fetchTimezone()
  }, [authFetch])

  // Gallery keyboard shortcuts: / to focus search, R to refresh, Escape to exit select mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape exits select mode from anywhere
      if (e.key === "Escape" && isSelectMode) {
        e.preventDefault()
        exitSelectMode()
        setShareResult(null)
        return
      }

      // Skip when modal or collection manager is open
      if (isModalOpen || showCollectionManager) return

      // Skip when focus is in an input/textarea
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if ((document.activeElement as HTMLElement)?.isContentEditable) return

      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        refresh()
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isModalOpen, showCollectionManager, refresh, isSelectMode, exitSelectMode])

  const dateGroups = useMemo(() => {
    const locale = language === "zh" ? "zh-CN" : "en-US"
    return groupImagesByDate(images, userTimezone, locale, {
      today: t.gallery?.today || "Today",
      yesterday: t.gallery?.yesterday || "Yesterday",
      thisWeek: t.gallery?.thisWeek || "This Week",
      thisMonth: t.gallery?.thisMonth || "This Month",
    })
  }, [images, userTimezone, language, t.gallery?.today, t.gallery?.yesterday, t.gallery?.thisWeek, t.gallery?.thisMonth])

  // Bulk action handlers
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return
    setIsBulkDeleting(true)
    try {
      const count = await bulkDelete(Array.from(selectedIds))
      exitSelectMode()
      // Show success via alert (simple approach matching existing patterns)
      console.log(`Deleted ${count} images`)
    } catch (err) {
      console.error("Bulk delete failed:", err)
    } finally {
      setIsBulkDeleting(false)
    }
  }, [selectedIds, bulkDelete, exitSelectMode])

  const handleBulkExport = useCallback(async (format: "png" | "jpg" | "webp") => {
    if (selectedIds.size === 0) return
    setIsBulkExporting(true)
    try {
      await bulkExport(Array.from(selectedIds), format)
      exitSelectMode()
    } catch (err) {
      console.error("Bulk export failed:", err)
    } finally {
      setIsBulkExporting(false)
    }
  }, [selectedIds, bulkExport, exitSelectMode])

  const handleBulkShare = useCallback(async () => {
    if (selectedIds.size === 0) return
    setIsBulkSharing(true)
    try {
      const result = await bulkShare(Array.from(selectedIds))
      setShareResult(result)
    } catch (err) {
      console.error("Bulk share failed:", err)
    } finally {
      setIsBulkSharing(false)
    }
  }, [selectedIds, bulkShare])

  const handleCopyShareLink = useCallback(async () => {
    if (!shareResult) return
    try {
      await navigator.clipboard.writeText(shareResult.shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement("textarea")
      textarea.value = shareResult.shareUrl
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }, [shareResult])

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

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)

    try {
      await uploadImage(file)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setIsUploading(false)
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const currentIndex = selectedImage
    ? images.findIndex((img) => img.id === selectedImage.id)
    : -1

  // Header right content with upload, refresh, and select buttons
  const headerRightContent = (
    <div className="flex items-center gap-1">
      {/* Select mode toggle */}
      <Button
        variant={isSelectMode ? "default" : "ghost"}
        size="icon"
        onClick={isSelectMode ? exitSelectMode : enterSelectMode}
        className={`h-9 w-9 ${isSelectMode ? "" : "text-muted-foreground hover:text-foreground"}`}
        title={t.gallery?.select || "Select"}
      >
        {isSelectMode ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
      </Button>
      {!isSelectMode && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUploadClick}
            disabled={isUploading}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title={t.gallery?.upload || "Upload"}
          >
            <Upload className={`h-4 w-4 ${isUploading ? "animate-pulse" : ""}`} />
          </Button>
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
        </>
      )}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Standardized Header */}
      <PageHeader
        title={t.gallery?.title}
        onNavigate={onNavigate}
        currentPage="gallery"
        rightContent={headerRightContent}
        onLogout={onLogout}
      />

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Sub-header with stats, filters & search */}
        <div className="sticky top-0 z-[9] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="container max-w-7xl mx-auto px-4 py-4">
          {/* Upload status messages */}
          {isUploading && (
            <div className="mb-4 px-4 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg text-sm flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t.gallery?.uploading || "Uploading..."}
            </div>
          )}
          {uploadError && (
            <div className="mb-4 px-4 py-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center justify-between">
              <span>{uploadError}</span>
              <button onClick={() => setUploadError(null)} className="hover:opacity-70">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
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
          <div className="flex flex-col gap-3">
            {/* Filter tabs + collection chips - horizontally scrollable on mobile */}
            <div
              className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0"
              style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <style>{`.gallery-chips-scroll::-webkit-scrollbar { display: none; }`}</style>
              <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                <button
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    filter === "all" && !collectionId
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                  onClick={() => { setFilter("all"); setCollectionId(null) }}
                >
                  {t.gallery?.allImages}
                </button>
                <button
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors border-l border-border whitespace-nowrap ${
                    filter === "favorites" && !collectionId
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                  onClick={() => { setFilter("favorites"); setCollectionId(null) }}
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

              {/* Collection chips */}
              {collections.map((c) => (
                <button
                  key={c.id}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap touch-manipulation ${
                    collectionId === c.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                  onClick={() => {
                    if (collectionId === c.id) {
                      setCollectionId(null)
                      setFilter("all")
                    } else {
                      setCollectionId(c.id)
                    }
                  }}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span className="max-w-[120px] truncate">{c.name}</span>
                  <span className={`text-xs ${collectionId === c.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {c.imageCount}
                  </span>
                </button>
              ))}

              {/* Manage collections button - icon only on mobile, text on desktop */}
              <button
                className="shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted touch-manipulation"
                onClick={() => setShowCollectionManager(true)}
                title={t.collections.manageCollections}
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {collections.length === 0 ? t.collections.title : t.collections.manageCollections}
                </span>
              </button>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} noValidate className="flex gap-2 w-full sm:max-w-md">
              <div className="relative flex-1">
                <Input
                  ref={searchInputRef}
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
            {(searchQuery || filter === "favorites" || collectionId) && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  clearSearch()
                  setFilter("all")
                  setCollectionId(null)
                }}
              >
                {t.gallery.viewAllImages}
              </Button>
            )}
          </div>
        )}

        {/* Image grid - grouped by date */}
        {images.length > 0 && (
          <>
            <div className="space-y-8">
              {dateGroups.map((group) => (
                <div key={group.labelKey}>
                  <div className="flex items-baseline gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                    <span className="text-xs text-muted-foreground">
                      ({group.images.length === 1
                        ? (t.gallery?.imageCountSingular || "{count} image").replace("{count}", "1")
                        : (t.gallery?.imageCount || "{count} images").replace("{count}", String(group.images.length))
                      })
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {group.images.map((image) => (
                      <GalleryCard
                        key={image.id}
                        image={image}
                        onSelect={handleSelectImage}
                        onToggleFavorite={toggleFavorite}
                        onDelete={deleteImage}
                        userTimezone={userTimezone}
                        onCollectionsChange={refreshCollections}
                        isSelectMode={isSelectMode}
                        isSelected={selectedIds.has(image.id)}
                        onToggleSelect={toggleSelect}
                      />
                    ))}
                  </div>
                </div>
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
      </div>

      {/* Bulk action bar */}
      {isSelectMode && selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={images.length}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onDelete={handleBulkDelete}
          onExport={handleBulkExport}
          onShare={handleBulkShare}
          onCancel={() => { exitSelectMode(); setShareResult(null) }}
          isDeleting={isBulkDeleting}
          isExporting={isBulkExporting}
          isSharing={isBulkSharing}
        />
      )}

      {/* Share result popover */}
      {shareResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => { setShareResult(null); exitSelectMode() }}>
          <div className="bg-background rounded-lg border border-border shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">{t.gallery.bulkShareSuccess}</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                readOnly
                value={shareResult.shareUrl}
                className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono"
              />
              <Button
                size="sm"
                onClick={handleCopyShareLink}
              >
                {shareCopied ? t.copied : t.copyLink}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShareResult(null); exitSelectMode() }}
              >
                {t.close}
              </Button>
            </div>
          </div>
        </div>
      )}

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
        userTimezone={userTimezone}
        onCollectionsChange={refreshCollections}
      />

      {/* Collection manager modal */}
      <CollectionManager
        isOpen={showCollectionManager}
        onClose={() => {
          setShowCollectionManager(false)
          refreshCollections()
        }}
      />
    </div>
  )
}
