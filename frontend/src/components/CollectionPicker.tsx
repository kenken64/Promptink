import { useState, useEffect, useRef } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { useCollections, type Collection } from "../hooks/useCollections"
import { useLanguage } from "../hooks/useLanguage"

interface CollectionPickerProps {
  imageId: number
  isOpen: boolean
  onClose: () => void
}

export function CollectionPicker({ imageId, isOpen, onClose }: CollectionPickerProps) {
  const { t } = useLanguage()
  const {
    collections,
    createCollection,
    addImageToCollection,
    removeImageFromCollection,
    getCollectionsForImage,
  } = useCollections()

  const [imageCollectionIds, setImageCollectionIds] = useState<number[]>([])
  const [isLoadingIds, setIsLoadingIds] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Fetch which collections this image belongs to
  useEffect(() => {
    if (isOpen && imageId) {
      setIsLoadingIds(true)
      getCollectionsForImage(imageId).then((ids) => {
        setImageCollectionIds(ids)
        setIsLoadingIds(false)
      })
    }
  }, [isOpen, imageId, getCollectionsForImage])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen, onClose])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleToggle = async (collection: Collection) => {
    if (togglingId) return
    setTogglingId(collection.id)

    try {
      const isInCollection = imageCollectionIds.includes(collection.id)
      if (isInCollection) {
        await removeImageFromCollection(collection.id, imageId)
        setImageCollectionIds((prev) => prev.filter((id) => id !== collection.id))
      } else {
        await addImageToCollection(collection.id, imageId)
        setImageCollectionIds((prev) => [...prev, collection.id])
      }
    } catch {
      // Error already logged in hook
    } finally {
      setTogglingId(null)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setIsCreating(true)
    try {
      const created = await createCollection(newName.trim())
      if (created) {
        // Auto-add the image to the newly created collection
        await addImageToCollection(created.id, imageId)
        setImageCollectionIds((prev) => [...prev, created.id])
      }
      setNewName("")
    } catch {
      // Error already logged
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        ref={modalRef}
        className="relative z-10 w-full sm:max-w-sm sm:mx-4 bg-background border border-border rounded-t-2xl sm:rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:fade-in duration-200"
      >
        {/* Drag handle for mobile */}
        <div className="flex justify-center pt-2 pb-0 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold">{t.collections.addToCollection}</h3>
          <button
            onClick={onClose}
            className="p-2 -m-1 rounded-lg hover:bg-muted transition-colors touch-manipulation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Collection list */}
        <div className="max-h-[50vh] sm:max-h-64 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {isLoadingIds ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-5 w-5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : collections.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <p>{t.collections.noCollections}</p>
              <p className="mt-1 text-xs">{t.collections.noCollectionsHint}</p>
            </div>
          ) : (
            collections.map((collection) => {
              const isInCollection = imageCollectionIds.includes(collection.id)
              const isToggling = togglingId === collection.id
              return (
                <label
                  key={collection.id}
                  className="flex items-center gap-3 px-4 py-3 sm:py-2.5 hover:bg-muted active:bg-muted cursor-pointer transition-colors touch-manipulation"
                >
                  <input
                    type="checkbox"
                    checked={isInCollection}
                    onChange={() => handleToggle(collection)}
                    disabled={isToggling}
                    className="rounded border-border h-5 w-5 sm:h-4 sm:w-4 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{collection.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {collection.imageCount === 1
                        ? t.collections.imageCountSingular.replace("{count}", "1")
                        : t.collections.imageCount.replace("{count}", String(collection.imageCount))}
                    </p>
                  </div>
                  {isToggling && (
                    <svg className="animate-spin h-4 w-4 text-muted-foreground shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                </label>
              )
            })
          )}
        </div>

        {/* Create new collection */}
        <div className="p-3 sm:p-3 pb-safe border-t border-border">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder={t.collections.namePlaceholder}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
              }}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={isCreating || !newName.trim()}
              className="touch-manipulation"
            >
              {isCreating ? "..." : t.collections.create}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
