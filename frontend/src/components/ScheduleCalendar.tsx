import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "./ui/button"
import { useLanguage } from "../hooks/useLanguage"
import type { ScheduledJob } from "../hooks/useSchedule"

interface ScheduleCalendarProps {
  jobs: ScheduledJob[]
  userTimezone: string
}

interface CalendarCell {
  day: number
  month: number
  year: number
  isCurrentMonth: boolean
  isToday: boolean
  jobs: ScheduledJob[]
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function isSameDay(a: { day: number; month: number; year: number }, b: { day: number; month: number; year: number }) {
  return a.day === b.day && a.month === b.month && a.year === b.year
}

function computeCalendarCells(year: number, month: number, jobs: ScheduledJob[]): CalendarCell[] {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  // Previous month
  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth)

  // Next month
  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year

  const today = new Date()
  const todayDay = today.getDate()
  const todayMonth = today.getMonth()
  const todayYear = today.getFullYear()

  const cells: CalendarCell[] = []

  // Leading cells from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    cells.push({
      day: d,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
      isToday: d === todayDay && prevMonth === todayMonth && prevYear === todayYear,
      jobs: [],
    })
  }

  // Current month cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      month,
      year,
      isCurrentMonth: true,
      isToday: d === todayDay && month === todayMonth && year === todayYear,
      jobs: [],
    })
  }

  // Trailing cells from next month
  const totalCells = cells.length <= 35 ? 35 : 42
  const remaining = totalCells - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({
      day: d,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
      isToday: d === todayDay && nextMonth === todayMonth && nextYear === todayYear,
      jobs: [],
    })
  }

  // Assign jobs to cells
  for (const job of jobs) {
    if (job.schedule_type === "once") {
      if (!job.scheduled_at) continue
      const date = new Date(job.scheduled_at)
      const jDay = date.getDate()
      const jMonth = date.getMonth()
      const jYear = date.getFullYear()
      for (const cell of cells) {
        if (cell.day === jDay && cell.month === jMonth && cell.year === jYear) {
          cell.jobs.push(job)
        }
      }
    } else if (job.schedule_type === "daily") {
      for (const cell of cells) {
        cell.jobs.push(job)
      }
    } else if (job.schedule_type === "weekly") {
      const days = job.schedule_days || []
      for (const cell of cells) {
        const dow = new Date(cell.year, cell.month, cell.day).getDay()
        if (days.includes(dow)) {
          cell.jobs.push(job)
        }
      }
    }
  }

  return cells
}

function getDotColor(job: ScheduledJob): string {
  if (job.last_error) return "bg-red-500"
  if (!job.is_enabled) return "bg-muted-foreground/30"
  if (job.schedule_type === "once") return "bg-blue-500"
  if (job.schedule_type === "daily") return "bg-teal-500"
  return "bg-violet-500"
}

function getTypeBadgeClass(type: string): string {
  if (type === "once") return "bg-blue-500/15 text-blue-600 dark:text-blue-400"
  if (type === "daily") return "bg-teal-500/15 text-teal-600 dark:text-teal-400"
  return "bg-violet-500/15 text-violet-600 dark:text-violet-400"
}

interface DayPopoverProps {
  cell: CalendarCell
  language: string
  onClose: () => void
  anchorRect: DOMRect | null
}

function DayPopover({ cell, language, onClose, anchorRect }: DayPopoverProps) {
  const { t } = useLanguage()
  const popoverRef = useRef<HTMLDivElement>(null)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640

  const dateLabel = useMemo(() => {
    const date = new Date(cell.year, cell.month, cell.day)
    return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date)
  }, [cell, language])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [onClose])

  // Desktop: position near anchor, flip above if not enough room below
  const style: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        maxHeight: "60vh",
      }
    : (() => {
        if (!anchorRect) return { position: "absolute" as const, zIndex: 50 }
        const popoverWidth = 320
        const popoverEstimatedHeight = Math.min(
          cell.jobs.length === 0 ? 120 : 80 + cell.jobs.length * 72,
          400
        )
        const spaceBelow = window.innerHeight - anchorRect.bottom - 16
        const spaceAbove = anchorRect.top - 16
        // Flip above if not enough room below and more room above
        let top: number
        if (spaceBelow >= popoverEstimatedHeight || spaceBelow >= spaceAbove) {
          top = anchorRect.bottom + 8
        } else {
          top = anchorRect.top - popoverEstimatedHeight - 8
          if (top < 16) top = 16
        }
        let left = anchorRect.left
        if (left + popoverWidth > window.innerWidth - 16) {
          left = window.innerWidth - popoverWidth - 16
        }
        if (left < 16) left = 16
        const maxH = top >= anchorRect.top
          ? window.innerHeight - top - 16
          : anchorRect.top - 8 - top
        return {
          position: "fixed" as const,
          top,
          left,
          zIndex: 50,
          width: popoverWidth,
          maxHeight: Math.max(maxH, 200),
        }
      })()

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobile && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      )}
      <div
        ref={popoverRef}
        style={style}
        className={`bg-popover border border-border shadow-lg overflow-y-auto ${
          isMobile ? "rounded-t-xl" : "rounded-lg w-80"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <span className="font-medium text-sm">{dateLabel}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Job list */}
        <div className="p-3 space-y-2">
          {cell.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">
              {t.schedule?.noJobsOnDay || "No scheduled jobs on this day"}
            </p>
          ) : (
            cell.jobs.map((job) => (
              <div
                key={job.id}
                className={`flex items-start gap-2 p-2 rounded-md border ${
                  !job.is_enabled ? "opacity-50" : ""
                } ${job.last_error ? "border-red-500/30 bg-red-500/5" : "bg-muted/30"}`}
              >
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${getDotColor(job)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{job.prompt}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {job.schedule_type !== "once" && (
                      <span>@ {job.schedule_time}</span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getTypeBadgeClass(job.schedule_type)}`}>
                      {t.schedule?.[job.schedule_type] || job.schedule_type}
                    </span>
                  </div>
                  {job.last_error && (
                    <p className="text-[11px] text-red-500 mt-1 truncate">{job.last_error}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

export function ScheduleCalendar({ jobs, userTimezone: _userTimezone }: ScheduleCalendarProps) {
  const { language, t } = useLanguage()
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedCell, setSelectedCell] = useState<CalendarCell | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const cells = useMemo(() => computeCalendarCells(year, month, jobs), [year, month, jobs])

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
      month: "long",
      year: "numeric",
    }).format(currentMonth)
  }, [currentMonth, language])

  const dayNames = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", { weekday: "short" })
    const narrowFormatter = new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", { weekday: "narrow" })
    // Generate day names starting from Sunday (0)
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(2024, 0, i) // Jan 2024 starts on Monday, but we need Sunday=0
      // Jan 7 2024 is Sunday
      const refDate = new Date(2024, 0, 7 + i)
      return {
        short: formatter.format(refDate),
        narrow: narrowFormatter.format(refDate),
      }
    })
  }, [language])

  const goToToday = useCallback(() => {
    const now = new Date()
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }, [])

  const goPrev = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }, [])

  const goNext = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }, [])

  const handleCellClick = useCallback((cell: CalendarCell, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setAnchorRect(rect)
    setSelectedCell(prev =>
      prev && isSameDay(prev, cell) ? null : cell
    )
  }, [])

  const closePopover = useCallback(() => {
    setSelectedCell(null)
    setAnchorRect(null)
  }, [])

  const isCurrentMonthToday = useMemo(() => {
    const now = new Date()
    return year === now.getFullYear() && month === now.getMonth()
  }, [year, month])

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold capitalize">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          {!isCurrentMonthToday && (
            <Button size="sm" variant="outline" onClick={goToToday} className="text-xs h-8 px-2">
              {t.schedule?.today || "Today"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={goPrev} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={goNext} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {/* Day name headers */}
        {dayNames.map((name, i) => (
          <div
            key={i}
            className="bg-muted/50 text-center text-xs font-medium text-muted-foreground py-2"
          >
            <span className="sm:hidden">{name.narrow}</span>
            <span className="hidden sm:inline">{name.short}</span>
          </div>
        ))}

        {/* Day cells */}
        {cells.map((cell, i) => {
          const isSelected = selectedCell && isSameDay(selectedCell, cell)
          const maxDots = 3
          const visibleJobs = cell.jobs.slice(0, maxDots)
          const extraCount = cell.jobs.length - maxDots

          return (
            <button
              key={i}
              onClick={(e) => handleCellClick(cell, e)}
              className={`bg-background min-h-[3rem] sm:min-h-[4.5rem] p-1 text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary ${
                cell.isToday ? "ring-2 ring-primary ring-inset" : ""
              } ${isSelected ? "bg-muted" : ""} ${
                !cell.isCurrentMonth ? "text-muted-foreground/40" : ""
              }`}
            >
              <span className={`text-xs sm:text-sm font-medium ${
                cell.isToday ? "text-primary font-bold" : ""
              }`}>
                {cell.day}
              </span>
              {cell.jobs.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {visibleJobs.map((job) => (
                    <span
                      key={job.id}
                      className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${getDotColor(job)}`}
                    />
                  ))}
                  {extraCount > 0 && (
                    <span className="text-[9px] sm:text-[10px] leading-none text-muted-foreground font-medium">
                      +{extraCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="relative z-[51] flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
          {t.schedule?.once || "One-time"}
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
          {t.schedule?.daily || "Daily"}
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
          {t.schedule?.weekly || "Weekly"}
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
          {t.schedule?.error || "Error"}
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
          {t.schedule?.disabled || "Disabled"}
        </span>
      </div>

      {/* Day popover */}
      {selectedCell && (
        <DayPopover
          cell={selectedCell}
          language={language}
          onClose={closePopover}
          anchorRect={anchorRect}
        />
      )}
    </div>
  )
}
