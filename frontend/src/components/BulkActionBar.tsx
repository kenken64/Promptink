import { useState } from "react"
import { Button } from "./ui/button"
import { useLanguage } from "../hooks/useLanguage"

interface BulkActionBarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onDeselectAll: () => void
  onDelete: () => void
  onExport: (format: "png" | "jpg" | "webp") => void
  onShare: () => void
  onCancel: () => void
  isDeleting?: boolean
  isExporting?: boolean
  isSharing?: boolean
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
  onExport,
  onShare,
  onCancel,
  isDeleting,
  isExporting,
  isSharing,
}: BulkActionBarProps) {
  const { t } = useLanguage()
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const allSelected = selectedCount === totalCount && totalCount > 0
  const isBusy = isDeleting || isExporting || isSharing

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="bg-background/95 backdrop-blur border-t border-border shadow-lg">
        <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Left: select all toggle + count */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="flex items-center gap-2 text-sm shrink-0"
              onClick={allSelected ? onDeselectAll : onSelectAll}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  allSelected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/50"
                }`}
              >
                {allSelected && (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
              <span className="hidden sm:inline text-muted-foreground">
                {allSelected ? t.gallery.deselectAll : t.gallery.selectAll}
              </span>
            </button>
            <span className="text-sm font-medium truncate">
              {selectedCount} {t.gallery.selected}
            </span>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Export button with dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isBusy || selectedCount > 20}
                title={selectedCount > 20 ? t.gallery.maxSelectExport : t.gallery.bulkExport}
              >
                {isExporting ? (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                )}
                <span className="hidden sm:inline ml-1.5">
                  {isExporting ? t.gallery.exporting : t.gallery.bulkExport}
                </span>
              </Button>

              {/* Export format dropdown */}
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute bottom-full mb-1 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                    <button
                      className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center justify-between"
                      onClick={() => { onExport("png"); setShowExportMenu(false) }}
                    >
                      <span>PNG</span>
                      <span className="text-xs text-muted-foreground">{t.gallery.exportBestQuality}</span>
                    </button>
                    <button
                      className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center justify-between"
                      onClick={() => { onExport("jpg"); setShowExportMenu(false) }}
                    >
                      <span>JPG</span>
                      <span className="text-xs text-muted-foreground">{t.gallery.exportSmaller}</span>
                    </button>
                    <button
                      className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center justify-between"
                      onClick={() => { onExport("webp"); setShowExportMenu(false) }}
                    >
                      <span>WebP</span>
                      <span className="text-xs text-muted-foreground">{t.gallery.exportSmallest}</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Share button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              disabled={isBusy}
            >
              {isSharing ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
              )}
              <span className="hidden sm:inline ml-1.5">{t.gallery.bulkShare}</span>
            </Button>

            {/* Delete button with inline confirm */}
            <div className="relative">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-destructive whitespace-nowrap hidden sm:inline">
                    {t.gallery.bulkDeleteConfirm.replace("{count}", String(selectedCount))}
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { onDelete(); setShowDeleteConfirm(false) }}
                    disabled={isBusy}
                  >
                    {isDeleting ? (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      t.gallery.delete
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isBusy}
                  className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  <span className="hidden sm:inline ml-1.5">{t.gallery.bulkDelete}</span>
                </Button>
              )}
            </div>

            {/* Cancel / exit select mode */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isBusy}
              className="h-8 w-8 p-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
