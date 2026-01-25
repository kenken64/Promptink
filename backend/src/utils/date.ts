/**
 * Convert SQLite datetime string to proper ISO 8601 format with UTC indicator.
 *
 * SQLite's CURRENT_TIMESTAMP stores dates in UTC but without timezone indicator:
 * "2024-01-25 10:30:00"
 *
 * JavaScript's new Date() parses this as LOCAL time unless we add "Z" or timezone:
 * "2024-01-25T10:30:00Z"
 *
 * @param sqliteDate - Date string from SQLite (e.g., "2024-01-25 10:30:00")
 * @returns ISO 8601 string with UTC indicator (e.g., "2024-01-25T10:30:00Z")
 */
export function toISODate(sqliteDate: string | null | undefined): string | null {
  if (!sqliteDate) return null

  // Already has timezone indicator
  if (sqliteDate.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(sqliteDate)) {
    return sqliteDate
  }

  // Replace space with T and append Z for UTC
  return sqliteDate.replace(" ", "T") + "Z"
}
