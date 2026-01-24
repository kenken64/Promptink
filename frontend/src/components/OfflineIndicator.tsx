import { useOnlineStatus } from "../hooks/useOnlineStatus"
import { WifiOff, Wifi } from "lucide-react"

export function OfflineIndicator() {
  const { isOnline, wasOffline } = useOnlineStatus()

  // Show nothing if online and wasn't recently offline
  if (isOnline && !wasOffline) {
    return null
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium transition-all duration-300 ${
        isOnline
          ? "bg-green-500 text-white"
          : "bg-amber-500 text-white"
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>You're offline — Viewing cached content</span>
        </>
      )}
    </div>
  )
}
