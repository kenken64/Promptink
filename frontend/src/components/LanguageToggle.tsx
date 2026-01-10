import { Button } from "./ui/button"
import type { Language } from "../hooks/useLanguage"

interface LanguageToggleProps {
  language: Language
  onToggle: () => void
}

export function LanguageToggle({ language, onToggle }: LanguageToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="font-medium"
      aria-label="Toggle language"
    >
      {language === "en" ? "中文" : "EN"}
    </Button>
  )
}
