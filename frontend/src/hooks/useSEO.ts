import { useEffect } from "react"

// SEO configuration for client-side navigation
interface SEOConfig {
  title: string
  description: string
}

// Route-specific SEO configurations
const routeSEOConfig: Record<string, SEOConfig> = {
  "/": {
    title: "PromptInk - AI Image Generator for TRMNL E-ink Displays",
    description: "Transform your ideas into stunning AI-generated images with DALL-E 3. Sync to TRMNL e-ink displays, create infographics, and build your visual gallery.",
  },
  "/admin": {
    title: "Admin Dashboard - PromptInk",
    description: "PromptInk administration dashboard for managing users and data.",
  },
  "/gallery": {
    title: "Image Gallery - PromptInk",
    description: "Browse your AI-generated image gallery. View, favorite, share, and export your creations.",
  },
  "/settings": {
    title: "Settings - PromptInk",
    description: "Configure your PromptInk account and TRMNL device settings.",
  },
  "/schedule": {
    title: "Scheduled Generation - PromptInk",
    description: "Schedule automatic AI image generation at specific times.",
  },
  "/batch": {
    title: "Batch Generation - PromptInk",
    description: "Generate multiple AI images at once with batch processing.",
  },
  "/subscription": {
    title: "Subscription - PromptInk",
    description: "Manage your PromptInk subscription and billing.",
  },
  "/orders": {
    title: "Orders - PromptInk",
    description: "View and manage your TRMNL device orders.",
  },
  "/purchase": {
    title: "Purchase TRMNL Device - PromptInk",
    description: "Order a TRMNL e-ink display to showcase your AI-generated artwork.",
  },
  "/login": {
    title: "Login - PromptInk",
    description: "Sign in to your PromptInk account to generate and manage AI images.",
  },
  "/register": {
    title: "Create Account - PromptInk",
    description: "Join PromptInk to start generating AI images with DALL-E 3.",
  },
  "/forgot-password": {
    title: "Reset Password - PromptInk",
    description: "Reset your PromptInk account password.",
  },
}

// Default SEO config
const defaultSEO: SEOConfig = {
  title: "PromptInk - AI Image Generator",
  description: "Generate stunning AI images with DALL-E 3 and sync them to your TRMNL e-ink display.",
}

// Get SEO config for a path
function getSEOForPath(path: string): SEOConfig {
  // Check for exact match
  if (routeSEOConfig[path]) {
    return routeSEOConfig[path]
  }

  // Check for share pages
  if (path.startsWith("/share/")) {
    return {
      title: "Shared Image - PromptInk",
      description: "View this AI-generated image on PromptInk.",
    }
  }

  return defaultSEO
}

// Update meta tag content
function updateMetaTag(name: string, content: string, isProperty = false) {
  const attribute = isProperty ? "property" : "name"
  let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement | null

  if (meta) {
    meta.content = content
  } else {
    meta = document.createElement("meta")
    meta.setAttribute(attribute, name)
    meta.content = content
    document.head.appendChild(meta)
  }
}

// Custom hook for updating SEO on route changes
export function useSEO(customTitle?: string, customDescription?: string) {
  useEffect(() => {
    const path = window.location.pathname
    const seo = getSEOForPath(path)

    // Use custom values if provided, otherwise use route config
    const title = customTitle || seo.title
    const description = customDescription || seo.description

    // Update document title
    document.title = title

    // Update meta description
    updateMetaTag("description", description)

    // Update Open Graph tags
    updateMetaTag("og:title", title, true)
    updateMetaTag("og:description", description, true)
    updateMetaTag("og:url", window.location.href, true)

    // Update Twitter Card tags
    updateMetaTag("twitter:title", title)
    updateMetaTag("twitter:description", description)
  }, [customTitle, customDescription])
}

// Hook specifically for setting page title
export function usePageTitle(title: string) {
  useEffect(() => {
    const fullTitle = title.includes("PromptInk") ? title : `${title} - PromptInk`
    document.title = fullTitle
    updateMetaTag("og:title", fullTitle, true)
    updateMetaTag("twitter:title", fullTitle)
  }, [title])
}

export default useSEO
