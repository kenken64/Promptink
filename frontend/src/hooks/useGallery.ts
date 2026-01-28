import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "./useAuth"

export interface GalleryImage {
  id: number
  imageUrl: string
  thumbnailUrl: string
  originalPrompt: string
  revisedPrompt: string | null
  model: string
  size: string
  style: string | null
  isEdit: boolean
  parentImageId: number | null
  isFavorite: boolean
  createdAt: string
}

export interface GalleryPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

export interface GalleryStats {
  total: number
  favorites: number
}

export interface BulkShareResult {
  shareId: string
  shareUrl: string
  socialLinks: Record<string, string>
}

interface GalleryState {
  images: GalleryImage[]
  pagination: GalleryPagination | null
  stats: GalleryStats | null
  isLoading: boolean
  error: string | null
  isOffline: boolean
  isFromCache: boolean
}

export function useGallery() {
  const { authFetch, isAuthenticated } = useAuth()
  const [state, setState] = useState<GalleryState>({
    images: [],
    pagination: null,
    stats: null,
    isLoading: false,
    error: null,
    isOffline: false,
    isFromCache: false,
  })
  const [filter, setFilter] = useState<"all" | "favorites">("all")
  const [collectionId, setCollectionId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Selection state for bulk operations
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery])

  // Fetch gallery images
  const fetchImages = useCallback(async (page = 1, append = false) => {
    if (!isAuthenticated) return

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      })

      if (collectionId) {
        params.set("collection", collectionId.toString())
      } else if (filter === "favorites") {
        params.set("favorites", "true")
      }

      if (debouncedSearchQuery) {
        params.set("search", debouncedSearchQuery)
      }

      const response = await authFetch(`/api/gallery?${params}`)

      // Check if response is from service worker cache
      const isFromCache = response.headers.get("X-From-Cache") === "true"

      const data = await response.json()

      // Handle offline response from service worker
      if (data.offline) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isOffline: true,
          isFromCache: false,
          error: "You're offline. Showing cached images.",
        }))
        return
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch gallery")
      }

      setState((prev) => ({
        ...prev,
        images: append ? [...prev.images, ...data.images] : data.images,
        pagination: data.pagination,
        isLoading: false,
        isOffline: false,
        isFromCache,
      }))
    } catch (err) {
      // Check if it's a network error (offline)
      const isNetworkError = err instanceof TypeError && err.message.includes("fetch")
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isOffline: isNetworkError || !navigator.onLine,
        error: isNetworkError 
          ? "You're offline. Showing cached images if available."
          : err instanceof Error ? err.message : "Failed to fetch gallery",
      }))
    }
  }, [isAuthenticated, authFetch, filter, debouncedSearchQuery, collectionId])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const response = await authFetch("/api/gallery/stats")

      const data = await response.json()

      if (response.ok) {
        setState((prev) => ({ ...prev, stats: data }))
      }
    } catch (err) {
      console.error("Failed to fetch gallery stats:", err)
    }
  }, [isAuthenticated, authFetch])

  // Toggle favorite
  const toggleFavorite = useCallback(async (imageId: number) => {
    try {
      const response = await authFetch(`/api/gallery/${imageId}/favorite`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to toggle favorite")
      }

      // Update local state
      setState((prev) => ({
        ...prev,
        images: prev.images.map((img) =>
          img.id === imageId ? { ...img, isFavorite: data.isFavorite } : img
        ),
        stats: prev.stats
          ? {
              ...prev.stats,
              favorites: data.isFavorite
                ? prev.stats.favorites + 1
                : prev.stats.favorites - 1,
            }
          : null,
      }))

      return data.isFavorite
    } catch (err) {
      console.error("Failed to toggle favorite:", err)
      throw err
    }
  }, [authFetch])

  // Delete image
  const deleteImage = useCallback(async (imageId: number) => {
    try {
      const response = await authFetch(`/api/gallery/${imageId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete image")
      }

      // Remove from local state
      setState((prev) => ({
        ...prev,
        images: prev.images.filter((img) => img.id !== imageId),
        stats: prev.stats
          ? { ...prev.stats, total: prev.stats.total - 1 }
          : null,
        pagination: prev.pagination
          ? { ...prev.pagination, total: prev.pagination.total - 1 }
          : null,
      }))

      return true
    } catch (err) {
      console.error("Failed to delete image:", err)
      throw err
    }
  }, [authFetch])

  // Upload image
  const uploadImage = useCallback(async (file: File, description?: string) => {
    const formData = new FormData()
    formData.append("image", file)
    if (description) {
      formData.append("description", description)
    }

    const response = await authFetch("/api/gallery/upload", {
      method: "POST",
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Failed to upload image")
    }

    // Add the new image to the beginning of the list
    setState((prev) => ({
      ...prev,
      images: [data.image, ...prev.images],
      stats: prev.stats
        ? { ...prev.stats, total: prev.stats.total + 1 }
        : null,
      pagination: prev.pagination
        ? { ...prev.pagination, total: prev.pagination.total + 1 }
        : null,
    }))

    return data.image as GalleryImage
  }, [authFetch])

  // Load more images
  const loadMore = useCallback(() => {
    if (state.pagination?.hasMore && !state.isLoading) {
      fetchImages(state.pagination.page + 1, true)
    }
  }, [state.pagination, state.isLoading, fetchImages])

  // Refresh gallery
  const refresh = useCallback(() => {
    fetchImages(1, false)
    fetchStats()
  }, [fetchImages, fetchStats])

  // Selection helpers
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(state.images.map(img => img.id)))
  }, [state.images])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const enterSelectMode = useCallback(() => {
    setIsSelectMode(true)
    setSelectedIds(new Set())
  }, [])

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  // Bulk delete
  const bulkDelete = useCallback(async (ids: number[]) => {
    const response = await authFetch("/api/gallery/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Failed to bulk delete")
    }

    // Remove from local state
    const deletedSet = new Set(ids)
    setState(prev => ({
      ...prev,
      images: prev.images.filter(img => !deletedSet.has(img.id)),
      stats: prev.stats
        ? { ...prev.stats, total: Math.max(0, prev.stats.total - data.deletedCount) }
        : null,
      pagination: prev.pagination
        ? { ...prev.pagination, total: Math.max(0, prev.pagination.total - data.deletedCount) }
        : null,
    }))

    return data.deletedCount as number
  }, [authFetch])

  // Bulk export
  const bulkExport = useCallback(async (ids: number[], format: "png" | "jpg" | "webp" = "png") => {
    const response = await authFetch("/api/gallery/bulk-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, format }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || "Failed to bulk export")
    }

    // Trigger download via hidden anchor
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `promptink-export-${Date.now()}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [authFetch])

  // Bulk share
  const bulkShare = useCallback(async (ids: number[], title?: string): Promise<BulkShareResult> => {
    const response = await authFetch("/api/share/create-gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: ids, title }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Failed to create shared gallery")
    }

    return {
      shareId: data.shareId,
      shareUrl: data.shareUrl,
      socialLinks: data.socialLinks,
    }
  }, [authFetch])

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchImages(1, false)
      fetchStats()
    }
  }, [isAuthenticated, filter, debouncedSearchQuery, collectionId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    images: state.images,
    pagination: state.pagination,
    stats: state.stats,
    isLoading: state.isLoading,
    error: state.error,
    isOffline: state.isOffline,
    isFromCache: state.isFromCache,
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
    // Selection / bulk
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
  }
}
