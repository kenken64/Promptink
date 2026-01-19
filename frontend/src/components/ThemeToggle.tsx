import { Moon, Sun, SunMoon } from "lucide-react"
import { Button } from "./ui/button"

type ThemeMode = "light" | "dark" | "auto"

interface ThemeToggleProps {
  theme: "light" | "dark"
  themeMode?: ThemeMode
  onToggle: () => void
}

export function ThemeToggle({ theme, themeMode = theme, onToggle }: ThemeToggleProps) {
  // Show icon based on mode: auto shows sun/moon combined, otherwise show current theme icon
  const getIcon = () => {
    if (themeMode === "auto") {
      return <SunMoon className="h-5 w-5" />
    }
    return theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />
  }

  const getLabel = () => {
    if (themeMode === "auto") return "Auto theme (day/night)"
    return theme === "light" ? "Switch to dark mode" : "Switch to light mode"
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={onToggle} 
      aria-label={getLabel()}
      title={getLabel()}
    >
      {getIcon()}
    </Button>
  )
}
