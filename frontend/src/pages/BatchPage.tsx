import { useState } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { PageHeader } from "../components/PageHeader"
import { useBatch, BatchJob, BatchJobWithItems, CreateBatchJobInput, BatchStatus } from "../hooks/useBatch"
import { useLanguage } from "../hooks/useLanguage"
import {
  Layers,
  Plus,
  Trash2,
  X,
  Check,
  RefreshCw,
  Monitor,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  Image,
  Eye,
  Copy,
} from "lucide-react"

type AppPage = "chat" | "gallery" | "schedule" | "batch" | "orders" | "subscription" | "settings"

interface BatchPageProps {
  onNavigate: (page: AppPage) => void
  onLogout?: () => void
}

const STYLE_PRESETS = [
  { id: "none", label: "None" },
  { id: "photorealistic", label: "Photorealistic" },
  { id: "anime", label: "Anime/Manga" },
  { id: "watercolor", label: "Watercolor" },
  { id: "oil-painting", label: "Oil Painting" },
  { id: "pixel-art", label: "Pixel Art" },
  { id: "3d-render", label: "3D Render" },
  { id: "sketch", label: "Pencil Sketch" },
  { id: "pop-art", label: "Pop Art" },
  { id: "minimalist", label: "Minimalist" },
  { id: "cinematic", label: "Cinematic" },
]

const SIZE_OPTIONS = [
  { value: "1024x1024", label: "Square (1024×1024)" },
  { value: "1792x1024", label: "Landscape (1792×1024)" },
  { value: "1024x1792", label: "Portrait (1024×1792)" },
]

const MAX_BATCH_SIZE = 10

interface BatchFormProps {
  initialData?: BatchJobWithItems | null
  onSubmit: (data: CreateBatchJobInput) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
}

function BatchForm({ initialData, onSubmit, onCancel, isSubmitting }: BatchFormProps) {
  const { t } = useLanguage()
  const [name, setName] = useState(initialData?.name ? `${initialData.name} (copy)` : "")
  const [prompts, setPrompts] = useState<string[]>(
    initialData?.items?.map(item => item.prompt) || [""]
  )
  const [size, setSize] = useState(initialData?.size || "1024x1024")
  const [stylePreset, setStylePreset] = useState(initialData?.style_preset || "none")
  const [autoSyncTrmnl, setAutoSyncTrmnl] = useState(!!initialData?.auto_sync_trmnl)

  const addPrompt = () => {
    if (prompts.length < MAX_BATCH_SIZE) {
      setPrompts([...prompts, ""])
    }
  }

  const removePrompt = (index: number) => {
    if (prompts.length > 1) {
      setPrompts(prompts.filter((_, i) => i !== index))
    }
  }

  const updatePrompt = (index: number, value: string) => {
    const newPrompts = [...prompts]
    newPrompts[index] = value
    setPrompts(newPrompts)
  }

  const validPrompts = prompts.filter(p => p.trim().length > 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (validPrompts.length === 0) return

    const data: CreateBatchJobInput = {
      name: name.trim() || undefined,
      prompts: validPrompts,
      size,
      stylePreset: stylePreset === "none" ? undefined : stylePreset,
      autoSyncTrmnl,
    }

    await onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Batch Name (Optional) */}
      <div>
        <label className="block text-sm font-medium mb-1">{t.batch?.batchName || "Batch Name (Optional)"}</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full p-2 border rounded-md bg-background"
          placeholder={t.batch?.batchNamePlaceholder || "e.g., Nature scenes"}
        />
      </div>

      {/* Prompts */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium">
            {t.batch?.prompts || "Prompts"} ({validPrompts.length}/{MAX_BATCH_SIZE})
          </label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={addPrompt}
            disabled={prompts.length >= MAX_BATCH_SIZE}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t.batch?.addPrompt || "Add"}
          </Button>
        </div>
        <div className="space-y-2">
          {prompts.map((prompt, index) => (
            <div key={index} className="flex gap-2">
              <div className="flex-1">
                <textarea
                  value={prompt}
                  onChange={e => updatePrompt(index, e.target.value)}
                  className="w-full min-h-[60px] p-2 border rounded-md bg-background resize-none"
                  placeholder={`${t.gallery?.prompt || "Prompt"} ${index + 1}...`}
                />
              </div>
              {prompts.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removePrompt(index)}
                  className="self-start mt-1"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Size & Style */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t.imageSize || "Image Size"}</label>
          <select
            value={size}
            onChange={e => setSize(e.target.value)}
            className="w-full p-2 border rounded-md bg-background"
          >
            {SIZE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t.imageStyle || "Style Preset"}</label>
          <select
            value={stylePreset}
            onChange={e => setStylePreset(e.target.value)}
            className="w-full p-2 border rounded-md bg-background"
          >
            {STYLE_PRESETS.map(opt => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Auto Sync to TRMNL */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="autoSyncTrmnl"
          checked={autoSyncTrmnl}
          onChange={e => setAutoSyncTrmnl(e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="autoSyncTrmnl" className="text-sm flex items-center gap-1">
          <Monitor className="h-4 w-4" />
          {t.schedule?.autoSyncTrmnl || "Auto-sync each image to TRMNL display"}
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          {t.schedule?.cancel || "Cancel"}
        </Button>
        <Button type="submit" disabled={isSubmitting || validPrompts.length === 0} className="flex-1">
          {isSubmitting ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          {t.batch?.startBatch || `Start Batch (${validPrompts.length} images)`}
        </Button>
      </div>
    </form>
  )
}

interface BatchCardProps {
  batch: BatchJob
  onView: () => void
  onCancel: () => void
  onDelete: () => void
  onDuplicate: () => void
}

function BatchCard({ batch, onView, onCancel, onDelete, onDuplicate }: BatchCardProps) {
  const { t } = useLanguage()

  const getStatusIcon = () => {
    switch (batch.status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "processing":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "cancelled":
        return <Ban className="h-4 w-4 text-gray-500" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    const statusKey = batch.status as keyof typeof t.batch
    return t.batch?.[statusKey] || batch.status.charAt(0).toUpperCase() + batch.status.slice(1)
  }

  const progress = Math.round(
    ((batch.completed_count + batch.failed_count) / batch.total_count) * 100
  )

  const isActive = batch.status === "pending" || batch.status === "processing"

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">
                {batch.name || `Batch #${batch.id}`}
              </p>
              <div className="flex items-center gap-1 text-sm">
                {getStatusIcon()}
                <span>{getStatusText()}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Image className="h-3 w-3" />
                {batch.completed_count + batch.failed_count}/{batch.total_count}
              </span>
              {batch.failed_count > 0 && (
                <span className="text-red-500">
                  {batch.failed_count} {t.batch?.failed || "failed"}
                </span>
              )}
              <span>{batch.size}</span>
              {batch.style_preset && batch.style_preset !== "none" && (
                <span>{batch.style_preset}</span>
              )}
            </div>

            {/* Progress Bar */}
            {isActive && (
              <div className="mt-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {progress}% {t.batch?.complete || "complete"}
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-1">
              {t.batch?.created || "Created"}: {new Date(batch.created_at).toLocaleString()}
            </p>
          </div>

          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={onView} title={t.batch?.view || "View"}>
              <Eye className="h-4 w-4" />
            </Button>
            {!isActive && (
              <Button size="icon" variant="ghost" onClick={onDuplicate} title={t.batch?.duplicate || "Duplicate"}>
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {isActive && (
              <Button size="icon" variant="ghost" onClick={onCancel} title={t.batch?.cancel || "Cancel"}>
                <Ban className="h-4 w-4" />
              </Button>
            )}
            {!isActive && (
              <Button size="icon" variant="ghost" onClick={onDelete} title={t.batch?.delete || "Delete"}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface BatchDetailModalProps {
  batch: BatchJobWithItems
  onClose: () => void
}

function BatchDetailModal({ batch, onClose }: BatchDetailModalProps) {
  const { t } = useLanguage()

  const getItemStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "processing":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {batch.name || `Batch #${batch.id}`}
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Summary */}
          <div className="flex items-center gap-4 text-sm">
            <span>
              <strong>{t.batch?.status || "Status"}:</strong> {batch.status}
            </span>
            <span>
              <strong>{t.batch?.total || "Total"}:</strong> {batch.total_count}
            </span>
            <span>
              <strong>{t.batch?.completed || "Completed"}:</strong> {batch.completed_count}
            </span>
            {batch.failed_count > 0 && (
              <span className="text-red-500">
                <strong>{t.batch?.failed || "Failed"}:</strong> {batch.failed_count}
              </span>
            )}
          </div>

          {/* Items */}
          <div className="space-y-2">
            <h3 className="font-medium">{t.batch?.images || "Images"}</h3>
            {batch.items.map((item, index) => (
              <div key={item.id} className="flex items-start gap-2 p-2 bg-muted rounded-md">
                <div className="flex items-center gap-2 min-w-[80px]">
                  {getItemStatusIcon(item.status)}
                  <span className="text-sm font-medium">#{index + 1}</span>
                  {item.synced_to_trmnl === 1 && (
                    <Monitor 
                      className="h-4 w-4 text-emerald-500" 
                      title={t.batch?.syncedToTrmnl || "Synced to TRMNL"} 
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.prompt}</p>
                  {item.error_message && (
                    <p className="text-xs text-red-500 mt-1">{item.error_message}</p>
                  )}
                </div>
                {item.image_id && (
                  <a
                    href={`/api/gallery/image/${item.image_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <img
                      src={`/api/gallery/thumbnail/${item.image_id}`}
                      alt={item.prompt}
                      className="w-12 h-12 object-cover rounded"
                    />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end p-4 border-t">
          <Button onClick={onClose}>
            {t.close || "Close"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function BatchPage({ onNavigate, onLogout }: BatchPageProps) {
  const { t } = useLanguage()
  const {
    batches,
    currentBatch,
    isLoading,
    error,
    fetchBatches,
    fetchBatch,
    createBatch,
    cancelBatch,
    deleteBatch,
    pollStatus,
    stopPolling,
  } = useBatch()

  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [pollingBatchId, setPollingBatchId] = useState<number | null>(null)
  const [duplicatingBatch, setDuplicatingBatch] = useState<BatchJobWithItems | null>(null)

  const handleCreate = async (data: CreateBatchJobInput) => {
    setIsSubmitting(true)
    try {
      const batch = await createBatch(data)
      if (batch) {
        setShowForm(false)
        setDuplicatingBatch(null) // Reset duplicate form
        // Start polling for this batch
        setPollingBatchId(batch.id)
        pollStatus(batch.id)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleView = async (batch: BatchJob) => {
    stopPolling()
    await fetchBatch(batch.id)
    setShowDetail(true)

    // If batch is still processing, continue polling
    if (batch.status === "pending" || batch.status === "processing") {
      setPollingBatchId(batch.id)
      pollStatus(batch.id)
    }
  }

  const handleCancel = async (batch: BatchJob) => {
    if (confirm(t.batch?.confirmCancelBatch || "Are you sure you want to cancel this batch?")) {
      stopPolling()
      await cancelBatch(batch.id)
    }
  }

  const handleDelete = async (batch: BatchJob) => {
    if (confirm(t.batch?.confirmDeleteBatch || "Are you sure you want to delete this batch?")) {
      await deleteBatch(batch.id)
    }
  }

  const handleDuplicate = async (batch: BatchJob) => {
    // Fetch full batch with items to get prompts
    const fullBatch = await fetchBatch(batch.id)
    if (fullBatch) {
      setDuplicatingBatch(fullBatch)
      setShowForm(false) // Hide new form if open
      setShowDetail(false) // Hide detail view if open
    }
  }

  const closeDetail = () => {
    setShowDetail(false)
    stopPolling()
    setPollingBatchId(null)
    fetchBatches() // Refresh list
  }

  // Check for any active batches and poll them
  const activeBatches = batches.filter(
    b => b.status === "pending" || b.status === "processing"
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Standardized Header */}
      <PageHeader
        title={t.batch?.title || "Batch Generation"}
        onNavigate={onNavigate}
        currentPage="batch"
        onLogout={onLogout}
      />

      <div className="container mx-auto p-4 max-w-2xl">
        {/* Description and New Batch button */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            {t.batch?.description || "Generate multiple images at once"}
          </p>
          {!showForm && !duplicatingBatch && (
            <Button 
              onClick={() => setShowForm(true)}
              className="rounded-xl font-medium text-white transition-all duration-300 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.batch?.newBatch || "New Batch"}
            </Button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

      {/* Create Form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t.batch?.createBatch || "Create Batch Job"}</CardTitle>
          </CardHeader>
          <CardContent>
            <BatchForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              isSubmitting={isSubmitting}
            />
          </CardContent>
        </Card>
      )}

      {/* Duplicate Form */}
      {duplicatingBatch && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t.batch?.duplicateBatch || "Duplicate Batch"}</CardTitle>
          </CardHeader>
          <CardContent>
            <BatchForm
              onSubmit={handleCreate}
              onCancel={() => setDuplicatingBatch(null)}
              isSubmitting={isSubmitting}
              initialData={duplicatingBatch}
            />
          </CardContent>
        </Card>
      )}

      {/* Active Batches Info */}
      {activeBatches.length > 0 && !showForm && (
        <div className="bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 p-3 rounded-md mb-4 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          {activeBatches.length === 1
            ? t.batch?.oneBatchProcessing || "1 batch is being processed..."
            : `${activeBatches.length} ${t.batch?.batchesProcessing || "batches are being processed..."}`}
        </div>
      )}

      {/* Batches List */}
      {isLoading && batches.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          {t.settings?.saving ? "Loading..." : "Loading..."}
        </div>
      ) : batches.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Layers className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>{t.batch?.noBatches || "No batch jobs yet"}</p>
          <p className="text-sm mt-1">
            {t.batch?.createBatchHint || "Create a batch to generate multiple images at once"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map(batch => (
            <BatchCard
              key={batch.id}
              batch={batch}
              onView={() => handleView(batch)}
              onCancel={() => handleCancel(batch)}
              onDelete={() => handleDelete(batch)}
              onDuplicate={() => handleDuplicate(batch)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && currentBatch && (
        <BatchDetailModal batch={currentBatch} onClose={closeDetail} />
      )}
      </div>
    </div>
  )
}
