import { useLanguage } from "../hooks/useLanguage"
import { getModifierLabel } from "../hooks/useKeyboardShortcuts"
import { PageHeader } from "../components/PageHeader"

type AppPage = "chat" | "gallery" | "schedule" | "batch" | "orders" | "subscription" | "settings"

interface KeyboardShortcutsPageProps {
  onNavigate: (page: AppPage) => void
  onLogout?: () => void
}

interface ShortcutEntry {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  title: string
  shortcuts: ShortcutEntry[]
}

export function KeyboardShortcutsPage({ onNavigate, onLogout }: KeyboardShortcutsPageProps) {
  const { t } = useLanguage()
  const mod = getModifierLabel()

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
    <div className="h-screen flex flex-col bg-background">
      <PageHeader
        title={t.shortcuts.title}
        onNavigate={onNavigate}
        currentPage="settings"
        onLogout={onLogout}
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="container max-w-lg mx-auto px-4 py-8">
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  {group.title}
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {group.shortcuts.map((shortcut, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-4 py-3 ${
                        i > 0 ? "border-t border-border" : ""
                      }`}
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
                            <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-xs font-mono font-medium bg-muted border border-border rounded-md shadow-sm">
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
    </div>
  )
}
