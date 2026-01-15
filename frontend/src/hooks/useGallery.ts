import { useState, useEffect, useCallback } from "react"
import { useAuth } from "./useAuth"

export interface GalleryImage {
  id: number
  imageUrl: string
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

interface GalleryState {
  images: GalleryImage[]
  pagination: GalleryPagination | null
  stats: GalleryStats | null
  isLoading: boolean
  error: string | null
}

export function useGallery() {
  const { getAuthHeader, isAuthenticated } = useAuth()
  const [state, setState] = useState<GalleryState>({
    images: [],
    pagination: null,
    stats: null,
    isLoading: false,
    error: null,
  })
  const [filter, setFilter] = useState<"all" | "favorites">("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch gallery images
  const fetchImages = useCallback(async (page = 1, append = false) => {
    if (!isAuthenticated) return

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      })

      if (filter === "favorites") {
        params.set("favorites", "true")
      }

      if (searchQuery) {
        params.set("search", searchQuery)
      }

      const response = await fetch(`/api/gallery?${params}`, {
        headers: getAuthHeader(),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch gallery")
      }

      setState((prev) => ({
        ...prev,
        images: append ? [...prev.images, ...data.images] : data.images,
        pagination: data.pagination,
        isLoading: false,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch gallery",
      }))
    }
  }, [isAuthenticated, getAuthHeader, filter, searchQuery])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const response = await fetch("/api/gallery/stats", {
        headers: getAuthHeader(),
      })

      const data = await response.json()

      if (response.ok) {
        setState((prev) => ({ ...prev, stats: data }))
      }
    } catch (err) {
      console.error("Failed to fetch gallery stats:", err)
    }
  }, [isAuthenticated, getAuthHeader])

  // Toggle favorite
  const toggleFavorite = useCallback(async (imageId: number) => {
    try {
      const response = await fetch(`/api/gallery/${imageId}/favorite`, {
        method: "POST",
        headers: getAuthHeader(),
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
  }, [getAuthHeader])

  // Delete image
  const deleteImage = useCallback(async (imageId: number) => {
    try {
      const response = await fetch(`/api/gallery/${imageId}`, {
        method: "DELETE",
        headers: getAuthHeader(),
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
  }, [getAuthHeader])

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

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchImages(1, false)
      fetchStats()
    }
  }, [isAuthenticated, filter, searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    images: state.images,
    pagination: state.pagination,
    stats: state.stats,
    isLoading: state.isLoading,
    error: state.error,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    toggleFavorite,
    deleteImage,
    loadMore,
    refresh,
  }
}
