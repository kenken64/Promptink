import { useState, useCallback, useEffect } from "react"
import { useAuth } from "./useAuth"

export interface Collection {
  id: number
  name: string
  description: string | null
  imageCount: number
  coverThumbnailUrl: string | null
  createdAt: string
  updatedAt: string
}

interface CollectionsState {
  collections: Collection[]
  isLoading: boolean
  error: string | null
}

export function useCollections() {
  const { authFetch, isAuthenticated } = useAuth()
  const [state, setState] = useState<CollectionsState>({
    collections: [],
    isLoading: false,
    error: null,
  })

  const fetchCollections = useCallback(async () => {
    if (!isAuthenticated) return

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await authFetch("/api/collections")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch collections")
      }

      setState({
        collections: data.collections,
        isLoading: false,
        error: null,
      })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch collections",
      }))
    }
  }, [isAuthenticated, authFetch])

  const createCollection = useCallback(async (name: string, description?: string): Promise<Collection | null> => {
    try {
      const response = await authFetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create collection")
      }

      setState((prev) => ({
        ...prev,
        collections: [data.collection, ...prev.collections],
      }))

      return data.collection
    } catch (err) {
      console.error("Failed to create collection:", err)
      throw err
    }
  }, [authFetch])

  const updateCollection = useCallback(async (id: number, name: string, description?: string) => {
    try {
      const response = await authFetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update collection")
      }

      setState((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === id ? { ...c, name, description: description || null } : c
        ),
      }))
    } catch (err) {
      console.error("Failed to update collection:", err)
      throw err
    }
  }, [authFetch])

  const deleteCollection = useCallback(async (id: number) => {
    try {
      const response = await authFetch(`/api/collections/${id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete collection")
      }

      setState((prev) => ({
        ...prev,
        collections: prev.collections.filter((c) => c.id !== id),
      }))
    } catch (err) {
      console.error("Failed to delete collection:", err)
      throw err
    }
  }, [authFetch])

  const addImageToCollection = useCallback(async (collectionId: number, imageId: number) => {
    try {
      const response = await authFetch(`/api/collections/${collectionId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add image to collection")
      }

      // Update image count locally
      setState((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === collectionId ? { ...c, imageCount: c.imageCount + 1 } : c
        ),
      }))
    } catch (err) {
      console.error("Failed to add image to collection:", err)
      throw err
    }
  }, [authFetch])

  const removeImageFromCollection = useCallback(async (collectionId: number, imageId: number) => {
    try {
      const response = await authFetch(`/api/collections/${collectionId}/images/${imageId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove image from collection")
      }

      // Update image count locally
      setState((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === collectionId ? { ...c, imageCount: Math.max(0, c.imageCount - 1) } : c
        ),
      }))
    } catch (err) {
      console.error("Failed to remove image from collection:", err)
      throw err
    }
  }, [authFetch])

  const getCollectionsForImage = useCallback(async (imageId: number): Promise<number[]> => {
    try {
      const response = await authFetch(`/api/collections/for-image/${imageId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get collections for image")
      }

      return data.collectionIds
    } catch (err) {
      console.error("Failed to get collections for image:", err)
      return []
    }
  }, [authFetch])

  const refresh = useCallback(() => {
    fetchCollections()
  }, [fetchCollections])

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchCollections()
    }
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    collections: state.collections,
    isLoading: state.isLoading,
    error: state.error,
    createCollection,
    updateCollection,
    deleteCollection,
    addImageToCollection,
    removeImageFromCollection,
    getCollectionsForImage,
    refresh,
  }
}
