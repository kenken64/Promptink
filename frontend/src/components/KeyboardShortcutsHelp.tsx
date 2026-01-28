import { useEffect, useRef } from "react"
import { useLanguage } from "../hooks/useLanguage"
import { getModifierLabel } from "../hooks/useKeyboardShortcuts"

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutEntry {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  title: string
  shortcuts: ShortcutEntry[]
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const { t } = useLanguage()
  const modalRef = useRef<HTMLDivElement>(null)
  const mod = getModifierLabel()

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  if (!isOpen) return null

  const groups: ShortcutGroup[] = [
    {
      title: t.shortcuts.navigation,
      shortcuts: [
        { keys: [mod, "N"], description: t.shortcuts.newChat },
      ],
    },
    {
      title: t.shortcuts.chat,
      shortcuts: [
        { keys: ["Enter"], description: t.shortcuts.sendMessage },
        { keys: ["Shift", "Enter"], description: t.shortcuts.newLine },
      ],
    },
    {
      title: t.shortcuts.gallery,
      shortcuts: [
        { keys: ["/"], description: t.shortcuts.focusSearch },
        { keys: ["R"], description: t.shortcuts.refreshGallery },
      ],
    },
    {
      title: t.shortcuts.imageViewer,
      shortcuts: [
        { keys: ["\u2190"], description: t.shortcuts.previousImage },
        { keys: ["\u2192"], description: t.shortcuts.nextImage },
        { keys: ["F"], description: t.shortcuts.toggleFavorite },
        { keys: ["D"], description: t.shortcuts.deleteImage },
        { keys: ["C"], description: t.shortcuts.addToCollection },
        { keys: ["E"], description: t.shortcuts.exportImage },
        { keys: ["Esc"], description: t.shortcuts.closeModal },
      ],
    },
    {
      title: t.shortcuts.general,
      shortcuts: [
        { keys: ["?"], description: t.shortcuts.showShortcuts },
      ],
    },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto bg-background border border-border rounded-xl shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-background/95 backdrop-blur-sm rounded-t-xl">
          <h2 className="text-lg font-semibold">{t.shortcuts.title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={t.shortcuts.closeModal}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-6">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      {shortcut.keys.map((key, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && (
                            <span className="text-xs text-muted-foreground">+</span>
                          )}
                          <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono font-medium bg-muted border border-border rounded shadow-sm">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
