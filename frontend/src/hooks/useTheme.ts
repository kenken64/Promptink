import { useState, useEffect } from "react"

type Theme = "light" | "dark"
type ThemeMode = "light" | "dark" | "auto"

/**
 * Check if current time is during night hours (7 PM - 7 AM)
 */
function isNightTime(): boolean {
  const hour = new Date().getHours()
  return hour >= 19 || hour < 7 // 7 PM to 7 AM is night
}

/**
 * Get the effective theme based on mode
 */
function getEffectiveTheme(mode: ThemeMode): Theme {
  if (mode === "auto") {
    return isNightTime() ? "dark" : "light"
  }
  return mode
}

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("themeMode") as ThemeMode
      if (stored) return stored
      // Default to auto mode
      return "auto"
    }
    return "auto"
  })

  const [theme, setTheme] = useState<Theme>(() => getEffectiveTheme(themeMode))

  // Update theme when mode changes or periodically for auto mode
  useEffect(() => {
    const updateTheme = () => {
      setTheme(getEffectiveTheme(themeMode))
    }

    updateTheme()

    // For auto mode, check every minute for day/night changes
    if (themeMode === "auto") {
      const interval = setInterval(updateTheme, 60000) // Check every minute
      return () => clearInterval(interval)
    }
  }, [themeMode])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [theme])

  // Save mode to localStorage
  useEffect(() => {
    localStorage.setItem("themeMode", themeMode)
  }, [themeMode])

  const toggleTheme = () => {
    // Cycle through: auto -> light -> dark -> auto
    setThemeMode((prev) => {
      if (prev === "auto") return "light"
      if (prev === "light") return "dark"
      return "auto"
    })
  }

  return { theme, themeMode, toggleTheme }
}
