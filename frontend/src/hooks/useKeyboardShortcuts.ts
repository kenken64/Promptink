import { useEffect, useState, useCallback, useMemo } from "react"

export interface ShortcutDef {
  key: string
  ctrl?: boolean
  handler: () => void
  description: string
  category: string
  allowInInput?: boolean
  when?: () => boolean
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean
}

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

export function getModifierLabel() {
  return isMac ? "Cmd" : "Ctrl"
}

function isInputElement(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  if (tag === "INPUT" || tag === "TEXTAREA") return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutDef[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const closeHelp = useCallback(() => setIsHelpOpen(false), [])
  const openHelp = useCallback(() => setIsHelpOpen(true), [])

  // Memoize shortcuts to avoid re-registering on every render
  const stableShortcuts = useMemo(() => shortcuts, [JSON.stringify(shortcuts.map(s => ({ key: s.key, ctrl: s.ctrl, category: s.category, description: s.description, allowInInput: s.allowInInput })))])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Help overlay toggle
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isInputElement(document.activeElement)) return
        e.preventDefault()
        setIsHelpOpen(prev => !prev)
        return
      }

      // Esc closes help
      if (e.key === "Escape" && isHelpOpen) {
        e.preventDefault()
        setIsHelpOpen(false)
        return
      }

      // Don't process shortcuts when help is open (except Esc handled above)
      if (isHelpOpen) return

      for (const shortcut of stableShortcuts) {
        const ctrlMatch = shortcut.ctrl
          ? (isMac ? e.metaKey : e.ctrlKey)
          : (!e.ctrlKey && !e.metaKey)

        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          !e.altKey
        ) {
          // Guard against inputs
          if (!shortcut.allowInInput && isInputElement(document.activeElement)) {
            continue
          }

          // Conditional activation
          if (shortcut.when && !shortcut.when()) {
            continue
          }

          e.preventDefault()
          shortcut.handler()
          return
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [enabled, stableShortcuts, isHelpOpen])

  return { isHelpOpen, closeHelp, openHelp }
}
