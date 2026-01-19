import { createRoot } from "react-dom/client"
import { lazy, Suspense } from "react"
import App from "./App"

// Lazy load admin page
const AdminPage = lazy(() => import("./pages/AdminPage"))

// Simple router based on URL path
function Router() {
  const path = window.location.pathname
  console.log("[Router] Current path:", path)

  // Admin route
  if (path === "/admin" || path === "/admin/") {
    console.log("[Router] Rendering AdminPage")
    return (
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen bg-zinc-950">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
        </div>
      }>
        <AdminPage />
      </Suspense>
    )
  }

  // Default: main app
  console.log("[Router] Rendering main App")
  return <App />
}

const root = createRoot(document.getElementById("root")!)
root.render(<Router />)
