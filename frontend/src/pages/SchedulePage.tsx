import { useState, useEffect } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { PageHeader } from "../components/PageHeader"
import { useSchedule, CreateScheduledJobInput, ScheduledJob } from "../hooks/useSchedule"
import { useLanguage } from "../hooks/useLanguage"
import { useAuth } from "../hooks/useAuth"
import { detectBrowserTimezone, getTimezoneLabel, formatDateInTimezone, formatDateTimeInTimezone } from "../utils"
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Power,
  PowerOff,
  X,
  Check,
  RefreshCw,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

type AppPage = "chat" | "gallery" | "schedule" | "batch" | "orders" | "subscription" | "settings"

interface SchedulePageProps {
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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

interface ScheduleFormProps {
  initialData?: ScheduledJob | null
  onSubmit: (data: CreateScheduledJobInput) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
  userTimezone: string
}

function ScheduleForm({ initialData, onSubmit, onCancel, isSubmitting, userTimezone }: ScheduleFormProps) {
  const { t } = useLanguage()
  const [prompt, setPrompt] = useState(initialData?.prompt || "")
  const [size, setSize] = useState(initialData?.size || "1024x1024")
  const [stylePreset, setStylePreset] = useState(initialData?.style_preset || "none")
  const [scheduleType, setScheduleType] = useState<"once" | "daily" | "weekly">(
    initialData?.schedule_type || "daily"
  )
  const [scheduleTime, setScheduleTime] = useState(initialData?.schedule_time || "09:00")
  const [scheduleDays, setScheduleDays] = useState<number[]>(initialData?.schedule_days || [1, 2, 3, 4, 5])
  
  // Convert UTC datetime to local datetime-local format for the input
  const getLocalDatetimeString = (isoString: string | undefined | null): string => {
    if (!isoString) return ""
    const date = new Date(isoString)
    // Format as YYYY-MM-DDTHH:MM in local time
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }
  
  const [scheduledAt, setScheduledAt] = useState(
    getLocalDatetimeString(initialData?.scheduled_at)
  )
  const [autoSyncTrmnl, setAutoSyncTrmnl] = useState(!!initialData?.auto_sync_trmnl)

  const handleDayToggle = (day: number) => {
    setScheduleDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const data: CreateScheduledJobInput = {
      prompt,
      size,
      stylePreset: stylePreset === "none" ? undefined : stylePreset,
      scheduleType,
      scheduleTime: scheduleType !== "once" ? scheduleTime : undefined,
      scheduleDays: scheduleType === "weekly" ? scheduleDays : undefined,
      scheduledAt: scheduleType === "once" ? scheduledAt : undefined,
      timezone: userTimezone,
      autoSyncTrmnl,
    }

    await onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium mb-1">{t.schedule?.prompt || "Prompt"}</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className="w-full min-h-[80px] p-2 border rounded-md bg-background resize-none"
          placeholder={t.schedule?.enterPrompt || "Enter your image prompt..."}
          required
        />
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

      {/* Schedule Type */}
      <div>
        <label className="block text-sm font-medium mb-1">{t.schedule?.scheduleType || "Schedule Type"}</label>
        <div className="flex gap-2">
          {(["once", "daily", "weekly"] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setScheduleType(type)}
              className={`flex-1 py-2 px-3 rounded-md border transition-colors ${
                scheduleType === type
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {t.schedule?.[type] || type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Time (for daily/weekly) */}
      {scheduleType !== "once" && (
        <div>
          <label className="block text-sm font-medium mb-1">{t.schedule?.scheduleTime || "Time"}</label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              type="time"
              value={scheduleTime}
              onChange={e => setScheduleTime(e.target.value)}
              className="pl-10 cursor-pointer"
              required
            />
          </div>
        </div>
      )}

      {/* Schedule Days (for weekly) */}
      {scheduleType === "weekly" && (
        <div>
          <label className="block text-sm font-medium mb-1">{t.schedule?.scheduleDays || "Days"}</label>
          <div className="flex gap-1">
            {DAY_NAMES.map((name, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleDayToggle(index)}
                className={`flex-1 py-2 px-1 text-xs rounded-md border transition-colors ${
                  scheduleDays.includes(index)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled At (for once) */}
      {scheduleType === "once" && (
        <div>
          <label className="block text-sm font-medium mb-1">{t.schedule?.scheduledAt || "Date & Time"}</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              min={getLocalDatetimeString(new Date().toISOString())}
              className="pl-10 cursor-pointer"
              required
            />
          </div>
        </div>
      )}

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
          {t.schedule?.autoSyncTrmnl || "Auto-sync to TRMNL display"}
        </label>
      </div>

      {/* Timezone indicator */}
      <div className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
        <Clock className="h-3 w-3" />
        <span>{t.schedule?.timezone || "Timezone"}: {getTimezoneLabel(userTimezone)}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          {t.schedule?.cancel || "Cancel"}
        </Button>
        <Button type="submit" disabled={isSubmitting || !prompt.trim()} className="flex-1">
          {isSubmitting ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          {initialData ? t.schedule?.update || "Update" : t.schedule?.create || "Create"}
        </Button>
      </div>
    </form>
  )
}

interface ScheduleCardProps {
  job: ScheduledJob
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggle: () => void
  userTimezone?: string
}

function ScheduleCard({ job, onEdit, onDuplicate, onDelete, onToggle, userTimezone }: ScheduleCardProps) {
  const { t } = useLanguage()
  const isEnabled = !!job.is_enabled

  const formatNextRun = (dateStr: string | null) => {
    if (!dateStr) return "-"
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()

    if (diffMs < 0) return t.schedule?.overdue || "Overdue"
    if (diffMs < 60000) return t.schedule?.soon || "Soon"
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h`
    // Use user timezone for date display (function handles fallback to browser timezone)
    return formatDateInTimezone(dateStr, userTimezone || "")
  }

  const getScheduleDescription = () => {
    if (job.schedule_type === "once") {
      if (!job.scheduled_at) return "-"
      // scheduled_at is stored as LOCAL time (user's input), display as-is without timezone conversion
      const date = new Date(job.scheduled_at)
      return date.toLocaleString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    }
    if (job.schedule_type === "daily") {
      return `${t.schedule?.daily || "Daily"} @ ${job.schedule_time}`
    }
    if (job.schedule_type === "weekly") {
      const days = job.schedule_days?.map(d => DAY_NAMES[d]).join(", ") || ""
      return `${days} @ ${job.schedule_time}`
    }
    return "-"
  }

  return (
    <Card className={`transition-opacity ${!isEnabled ? "opacity-50" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{job.prompt}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Calendar className="h-3 w-3" />
              <span>{getScheduleDescription()}</span>
            </div>
            {isEnabled && job.next_run_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Clock className="h-3 w-3" />
                <span>
                  {t.schedule?.nextRun || "Next"}: {formatNextRun(job.next_run_at)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{job.size}</span>
              {job.style_preset && <span>{job.style_preset}</span>}
              {job.auto_sync_trmnl && (
                <span className="flex items-center gap-1">
                  <Monitor className="h-3 w-3" />
                  TRMNL
                </span>
              )}
              {job.run_count > 0 && (
                <span>{job.run_count} {t.schedule?.runs || "runs"}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onToggle} title={isEnabled ? "Disable" : "Enable"}>
              {isEnabled ? (
                <Power className="h-4 w-4 text-green-500" />
              ) : (
                <PowerOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit} title={t.schedule?.edit || "Edit"}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDuplicate} title={t.schedule?.duplicate || "Duplicate"}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} title={t.schedule?.delete || "Delete"}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SchedulePage({ onNavigate, onLogout }: SchedulePageProps) {
  const { t } = useLanguage()
  const { authFetch } = useAuth()
  const { jobs, pagination, maxJobsAllowed, isLoading, error, createJob, updateJob, deleteJob, toggleJob, nextPage, prevPage } = useSchedule()
  const total = pagination?.total ?? 0
  const limit = maxJobsAllowed
  const [showForm, setShowForm] = useState(false)
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null)
  const [duplicatingJob, setDuplicatingJob] = useState<ScheduledJob | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
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

  const handleCreate = async (data: CreateScheduledJobInput) => {
    setIsSubmitting(true)
    try {
      const result = await createJob(data)
      if (result) {
        setShowForm(false)
        setDuplicatingJob(null)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (data: CreateScheduledJobInput) => {
    if (!editingJob) return
    setIsSubmitting(true)
    try {
      const result = await updateJob(editingJob.id, data)
      if (result) {
        setEditingJob(null)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    await deleteJob(id)
    setDeleteConfirm(null)
  }

  const handleToggle = async (id: number) => {
    await toggleJob(id)
  }

  const canCreateMore = total < limit

  return (
    <div className="h-screen bg-background overflow-y-auto">
      {/* Standardized Header */}
      <PageHeader
        title={t.schedule?.title || "Schedule"}
        onNavigate={onNavigate}
        currentPage="schedule"
        onLogout={onLogout}
      />

      <div className="container max-w-2xl mx-auto p-4 pb-24">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            {t.schedule?.description || "Automatically generate images on a schedule"}
          </p>
          {/* New Schedule button */}
          {!showForm && !editingJob && !duplicatingJob && (
            <Button
              onClick={() => setShowForm(true)}
              disabled={!canCreateMore}
              title={!canCreateMore ? `Maximum ${limit} schedules` : undefined}
              className="rounded-xl font-medium text-white transition-all duration-300 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.schedule?.newSchedule || "New Schedule"}
            </Button>
          )}
        </div>

      {/* Create Form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t.schedule?.createSchedule || "Create Schedule"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduleForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              isSubmitting={isSubmitting}
              userTimezone={userTimezone}
            />
          </CardContent>
        </Card>
      )}

      {/* Edit Form */}
      {editingJob && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t.schedule?.editSchedule || "Edit Schedule"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduleForm
              initialData={editingJob}
              onSubmit={handleUpdate}
              onCancel={() => setEditingJob(null)}
              isSubmitting={isSubmitting}
              userTimezone={userTimezone}
            />
          </CardContent>
        </Card>
      )}

      {/* Duplicate Form */}
      {duplicatingJob && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t.schedule?.duplicateSchedule || "Duplicate Schedule"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduleForm
              initialData={{
                ...duplicatingJob,
                id: 0, // Reset id so it creates a new one
                scheduled_at: null, // Reset one-time schedule date
              }}
              onSubmit={handleCreate}
              onCancel={() => setDuplicatingJob(null)}
              isSubmitting={isSubmitting}
              userTimezone={userTimezone}
            />
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="text-sm text-muted-foreground mb-4">
        {total} / {limit} {t.schedule?.schedulesUsed || "schedules"}
      </div>

      {/* Jobs List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t.schedule?.noSchedules || "No scheduled jobs yet"}</p>
          <p className="text-sm mt-1">
            {t.schedule?.createFirstSchedule || "Create your first schedule to get started"}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="relative">
                <ScheduleCard
                  job={job}
                  onEdit={() => setEditingJob(job)}
                  onDuplicate={() => setDuplicatingJob(job)}
                  onDelete={() => setDeleteConfirm(job.id)}
                  onToggle={() => handleToggle(job.id)}
                  userTimezone={userTimezone}
                />
                {/* Delete Confirmation */}
                {deleteConfirm === job.id && (
                  <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center rounded-lg">
                    <div className="text-center p-4">
                      <p className="font-medium mb-3">{t.schedule?.confirmDelete || "Delete this schedule?"}</p>
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>
                          <X className="h-4 w-4 mr-1" />
                          {t.schedule?.cancel || "Cancel"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(job.id)}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t.schedule?.delete || "Delete"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {t.schedule?.showingPage || "Page"} {pagination.page} {t.schedule?.of || "of"} {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={prevPage}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t.schedule?.previous || "Previous"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={nextPage}
                  disabled={!pagination.hasMore}
                >
                  {t.schedule?.next || "Next"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}
