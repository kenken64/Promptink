// Common timezone options grouped by region
export const TIMEZONE_OPTIONS = [
  // UTC
  { value: "UTC", label: "UTC (Coordinated Universal Time)", offset: "UTC+0" },

  // Americas
  { value: "America/New_York", label: "Eastern Time (New York)", offset: "UTC-5/-4" },
  { value: "America/Chicago", label: "Central Time (Chicago)", offset: "UTC-6/-5" },
  { value: "America/Denver", label: "Mountain Time (Denver)", offset: "UTC-7/-6" },
  { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)", offset: "UTC-8/-7" },
  { value: "America/Anchorage", label: "Alaska Time (Anchorage)", offset: "UTC-9/-8" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (Honolulu)", offset: "UTC-10" },
  { value: "America/Toronto", label: "Eastern Time (Toronto)", offset: "UTC-5/-4" },
  { value: "America/Vancouver", label: "Pacific Time (Vancouver)", offset: "UTC-8/-7" },
  { value: "America/Sao_Paulo", label: "Brasilia Time (Sao Paulo)", offset: "UTC-3" },
  { value: "America/Mexico_City", label: "Central Time (Mexico City)", offset: "UTC-6/-5" },

  // Europe
  { value: "Europe/London", label: "British Time (London)", offset: "UTC+0/+1" },
  { value: "Europe/Paris", label: "Central European Time (Paris)", offset: "UTC+1/+2" },
  { value: "Europe/Berlin", label: "Central European Time (Berlin)", offset: "UTC+1/+2" },
  { value: "Europe/Amsterdam", label: "Central European Time (Amsterdam)", offset: "UTC+1/+2" },
  { value: "Europe/Rome", label: "Central European Time (Rome)", offset: "UTC+1/+2" },
  { value: "Europe/Madrid", label: "Central European Time (Madrid)", offset: "UTC+1/+2" },
  { value: "Europe/Moscow", label: "Moscow Time", offset: "UTC+3" },
  { value: "Europe/Istanbul", label: "Turkey Time (Istanbul)", offset: "UTC+3" },

  // Asia
  { value: "Asia/Dubai", label: "Gulf Standard Time (Dubai)", offset: "UTC+4" },
  { value: "Asia/Kolkata", label: "India Standard Time (Mumbai)", offset: "UTC+5:30" },
  { value: "Asia/Dhaka", label: "Bangladesh Time (Dhaka)", offset: "UTC+6" },
  { value: "Asia/Bangkok", label: "Indochina Time (Bangkok)", offset: "UTC+7" },
  { value: "Asia/Ho_Chi_Minh", label: "Indochina Time (Ho Chi Minh)", offset: "UTC+7" },
  { value: "Asia/Jakarta", label: "Western Indonesia Time (Jakarta)", offset: "UTC+7" },
  { value: "Asia/Singapore", label: "Singapore Time", offset: "UTC+8" },
  { value: "Asia/Hong_Kong", label: "Hong Kong Time", offset: "UTC+8" },
  { value: "Asia/Shanghai", label: "China Standard Time (Shanghai)", offset: "UTC+8" },
  { value: "Asia/Taipei", label: "Taipei Time", offset: "UTC+8" },
  { value: "Asia/Seoul", label: "Korea Standard Time (Seoul)", offset: "UTC+9" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (Tokyo)", offset: "UTC+9" },

  // Australia & Pacific
  { value: "Australia/Perth", label: "Australian Western Time (Perth)", offset: "UTC+8" },
  { value: "Australia/Adelaide", label: "Australian Central Time (Adelaide)", offset: "UTC+9:30/+10:30" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (Sydney)", offset: "UTC+10/+11" },
  { value: "Australia/Melbourne", label: "Australian Eastern Time (Melbourne)", offset: "UTC+10/+11" },
  { value: "Australia/Brisbane", label: "Australian Eastern Time (Brisbane)", offset: "UTC+10" },
  { value: "Pacific/Auckland", label: "New Zealand Time (Auckland)", offset: "UTC+12/+13" },

  // Africa & Middle East
  { value: "Africa/Johannesburg", label: "South Africa Time (Johannesburg)", offset: "UTC+2" },
  { value: "Africa/Cairo", label: "Egypt Time (Cairo)", offset: "UTC+2" },
  { value: "Africa/Lagos", label: "West Africa Time (Lagos)", offset: "UTC+1" },
  { value: "Asia/Jerusalem", label: "Israel Time (Jerusalem)", offset: "UTC+2/+3" },
]

// Detect the user's browser timezone
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "UTC"
  }
}

// Get timezone display label
export function getTimezoneLabel(timezone: string): string {
  const option = TIMEZONE_OPTIONS.find(tz => tz.value === timezone)
  if (option) {
    return option.label
  }
  // If not in our list, return the raw IANA name
  return timezone
}

// Get current offset for a timezone (formatted like +05:30 or -08:00)
export function getTimezoneOffset(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    })
    const parts = formatter.formatToParts(new Date())
    const offsetPart = parts.find(p => p.type === 'timeZoneName')
    return offsetPart?.value || ''
  } catch {
    return ''
  }
}
