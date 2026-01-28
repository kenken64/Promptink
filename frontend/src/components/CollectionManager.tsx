import { useState, useEffect, useRef } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { useCollections } from "../hooks/useCollections"
import { useLanguage } from "../hooks/useLanguage"

interface CollectionManagerProps {
  isOpen: boolean
  onClose: () => void
}

export function CollectionManager({ isOpen, onClose }: CollectionManagerProps) {
  const { t } = useLanguage()
  const {
    collections,
    isLoading,
    createCollection,
    updateCollection,
    deleteCollection,
    refresh,
  } = useCollections()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState("")
  const [newName, setNewName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Refresh collections when modal opens
  useEffect(() => {
    if (isOpen) {
      refresh()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (e.key === "Escape") {
        if (editingId) {
          setEditingId(null)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose, editingId])

  if (!isOpen) return null

  const handleStartEdit = (id: number, name: string) => {
    setEditingId(id)
    setEditName(name)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return
    try {
      await updateCollection(editingId, editName.trim())
      setEditingId(null)
    } catch {
      // Error logged in hook
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t.collections.deleteConfirm)) return
    setDeletingId(id)
    try {
      await deleteCollection(id)
    } catch {
      // Error logged in hook
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setIsCreating(true)
    try {
      await createCollection(newName.trim())
      setNewName("")
    } catch {
      // Error logged in hook
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-md bg-background border border-border rounded-lg shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold">{t.collections.manageCollections}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Collection list */}
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
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
            collections.map((collection) => (
              <div
                key={collection.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                {editingId === collection.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit()
                        if (e.key === "Escape") setEditingId(null)
                      }}
                      className="text-sm"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveEdit} disabled={!editName.trim()}>
                      {t.collections.save}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      {t.collections.cancel}
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Collection icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-muted-foreground shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{collection.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {collection.imageCount === 1
                          ? t.collections.imageCountSingular.replace("{count}", "1")
                          : t.collections.imageCount.replace("{count}", String(collection.imageCount))}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleStartEdit(collection.id, collection.name)}
                        title={t.collections.rename}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 hover:text-destructive"
                        onClick={() => handleDelete(collection.id)}
                        disabled={deletingId === collection.id}
                        title={t.collections.delete}
                      >
                        {deletingId === collection.id ? (
                          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Create new collection */}
        <div className="p-3 border-t border-border">
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
            >
              {isCreating ? "..." : t.collections.create}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
