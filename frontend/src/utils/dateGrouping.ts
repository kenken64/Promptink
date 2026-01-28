import type { GalleryImage } from "../hooks/useGallery"

export interface DateGroup {
  label: string
  labelKey: string
  images: GalleryImage[]
}

/**
 * Get the start of a day in a specific timezone.
 * Returns a Date object representing midnight of that day in the given timezone.
 */
function getLocalDate(date: Date, timezone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date)

  const year = Number(parts.find(p => p.type === "year")!.value)
  const month = Number(parts.find(p => p.type === "month")!.value)
  const day = Number(parts.find(p => p.type === "day")!.value)

  return { year, month, day }
}

/**
 * Get the ISO weekday (1=Monday, 7=Sunday) for a date in a specific timezone.
 */
function getISOWeekday(date: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date)

  const map: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  }
  return map[weekday] || 1
}

/**
 * Determine which date bucket an image belongs to.
 * Returns a labelKey like "today", "yesterday", "thisWeek", "thisMonth", or "2025-01" for older months.
 */
function getDateBucket(
  imageDate: Date,
  now: Date,
  timezone: string,
): string {
  const imgLocal = getLocalDate(imageDate, timezone)
  const nowLocal = getLocalDate(now, timezone)

  // Same day
  if (imgLocal.year === nowLocal.year && imgLocal.month === nowLocal.month && imgLocal.day === nowLocal.day) {
    return "today"
  }

  // Yesterday: create a date for yesterday in the timezone
  const yesterdayMs = now.getTime() - 86400000
  const yesterdayDate = new Date(yesterdayMs)
  const yLocal = getLocalDate(yesterdayDate, timezone)
  if (imgLocal.year === yLocal.year && imgLocal.month === yLocal.month && imgLocal.day === yLocal.day) {
    return "yesterday"
  }

  // This week (ISO week: Monday-Sunday)
  // Find the start of this week (Monday) in the user's timezone
  const todayWeekday = getISOWeekday(now, timezone)
  const daysSinceMonday = todayWeekday - 1
  const weekStartMs = now.getTime() - daysSinceMonday * 86400000
  const weekStartLocal = getLocalDate(new Date(weekStartMs), timezone)

  // Check if image is in the same week (on or after Monday of this week)
  // We compare by checking if the image date >= week start date
  const imgDateNum = imgLocal.year * 10000 + imgLocal.month * 100 + imgLocal.day
  const weekStartNum = weekStartLocal.year * 10000 + weekStartLocal.month * 100 + weekStartLocal.day
  const nowDateNum = nowLocal.year * 10000 + nowLocal.month * 100 + nowLocal.day

  if (imgDateNum >= weekStartNum && imgDateNum <= nowDateNum) {
    return "thisWeek"
  }

  // This month
  if (imgLocal.year === nowLocal.year && imgLocal.month === nowLocal.month) {
    return "thisMonth"
  }

  // Older: group by year-month
  return `${imgLocal.year}-${String(imgLocal.month).padStart(2, "0")}`
}

/**
 * Format an older month key like "2025-01" into a localized label like "January 2025".
 */
function formatMonthLabel(key: string, locale: string): string {
  const [year, month] = key.split("-").map(Number)
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date)
}

/**
 * Group gallery images by date relative to now, using the user's timezone.
 * Images should already be sorted newest-first (by created_at DESC).
 */
export function groupImagesByDate(
  images: GalleryImage[],
  timezone: string,
  locale: string = "en",
  labels: { today: string; yesterday: string; thisWeek: string; thisMonth: string } = {
    today: "Today",
    yesterday: "Yesterday",
    thisWeek: "This Week",
    thisMonth: "This Month",
  },
): DateGroup[] {
  if (images.length === 0) return []

  const now = new Date()
  const groupMap = new Map<string, GalleryImage[]>()
  const groupOrder: string[] = []

  for (const image of images) {
    const imageDate = new Date(image.createdAt)
    const bucket = getDateBucket(imageDate, now, timezone)

    if (!groupMap.has(bucket)) {
      groupMap.set(bucket, [])
      groupOrder.push(bucket)
    }
    groupMap.get(bucket)!.push(image)
  }

  const labelMap: Record<string, string> = {
    today: labels.today,
    yesterday: labels.yesterday,
    thisWeek: labels.thisWeek,
    thisMonth: labels.thisMonth,
  }

  return groupOrder.map(key => ({
    labelKey: key,
    label: labelMap[key] || formatMonthLabel(key, locale),
    images: groupMap.get(key)!,
  }))
}
