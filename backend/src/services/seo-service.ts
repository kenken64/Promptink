import { config } from "../config"

// SEO meta tags configuration for each route
export interface SEOConfig {
  title: string
  description: string
  keywords?: string
  ogType?: "website" | "article" | "product"
  ogImage?: string
  twitterCard?: "summary" | "summary_large_image"
  canonical?: string
  noindex?: boolean
}

// Default site-wide SEO config
const defaultSEO: SEOConfig = {
  title: "PromptInk - AI Image Generator for TRMNL E-ink Displays",
  description: "Generate stunning AI images with DALL-E 3 and sync them to your TRMNL e-ink display. Create, share, and display your AI art.",
  keywords: "AI image generator, DALL-E 3, e-ink display, TRMNL, AI art, text to image, image generation",
  ogType: "website",
  ogImage: `${config.server.baseUrl}/og-image.png`,
  twitterCard: "summary_large_image",
}

// Static route SEO configurations
const routeSEOConfig: Record<string, Partial<SEOConfig>> = {
  "/": {
    title: "PromptInk - AI Image Generator for TRMNL E-ink Displays",
    description: "Transform your ideas into stunning AI-generated images with DALL-E 3. Sync to TRMNL e-ink displays, create infographics, and build your visual gallery.",
  },
  "/admin": {
    title: "Admin Dashboard - PromptInk",
    description: "PromptInk administration dashboard for managing users and data.",
    noindex: true,
  },
  "/gallery": {
    title: "Image Gallery - PromptInk",
    description: "Browse your AI-generated image gallery. View, favorite, share, and export your creations.",
    ogType: "website",
  },
  "/settings": {
    title: "Settings - PromptInk",
    description: "Configure your PromptInk account and TRMNL device settings.",
    noindex: true,
  },
  "/schedule": {
    title: "Scheduled Generation - PromptInk",
    description: "Schedule automatic AI image generation at specific times. Set up daily or weekly image creation.",
    noindex: true,
  },
  "/batch": {
    title: "Batch Generation - PromptInk",
    description: "Generate multiple AI images at once with batch processing.",
    noindex: true,
  },
  "/subscription": {
    title: "Subscription - PromptInk",
    description: "Manage your PromptInk subscription and billing.",
    noindex: true,
  },
  "/orders": {
    title: "Orders - PromptInk",
    description: "View and manage your TRMNL device orders.",
    noindex: true,
  },
  "/purchase": {
    title: "Purchase TRMNL Device - PromptInk",
    description: "Order a TRMNL e-ink display to showcase your AI-generated artwork.",
    ogType: "product",
  },
  "/login": {
    title: "Login - PromptInk",
    description: "Sign in to your PromptInk account to generate and manage AI images.",
  },
  "/register": {
    title: "Create Account - PromptInk",
    description: "Join PromptInk to start generating AI images with DALL-E 3 and sync them to your e-ink display.",
  },
  "/forgot-password": {
    title: "Reset Password - PromptInk",
    description: "Reset your PromptInk account password.",
    noindex: true,
  },
}

// Get SEO config for a specific route
export async function getSEOConfig(pathname: string): Promise<SEOConfig> {
  // Check for dynamic share route
  if (pathname.startsWith("/share/")) {
    const shareId = pathname.split("/")[2]
    if (shareId) {
      return await getSharePageSEO(shareId)
    }
  }

  // Check for static route config
  const staticConfig = routeSEOConfig[pathname]
  if (staticConfig) {
    return { ...defaultSEO, ...staticConfig, canonical: `${config.server.baseUrl}${pathname}` }
  }

  // Default SEO for unknown routes
  return { ...defaultSEO, canonical: `${config.server.baseUrl}${pathname}` }
}

// Get SEO config for shared image pages
// Note: Share pages are served with full meta tags from the share route handler
// This provides basic SEO for the initial HTML before the share route takes over
async function getSharePageSEO(shareId: string): Promise<SEOConfig> {
  return {
    title: "Shared Image - PromptInk",
    description: "View this AI-generated image created with DALL-E 3 on PromptInk.",
    keywords: "AI art, AI generated image, DALL-E, PromptInk",
    ogType: "article",
    ogImage: `${config.server.baseUrl}/api/share/${shareId}/image`,
    twitterCard: "summary_large_image",
    canonical: `${config.server.baseUrl}/share/${shareId}`,
  }
}

// Generate meta tags HTML string
export function generateMetaTagsHTML(seo: SEOConfig): string {
  const tags: string[] = []

  // Basic meta tags
  tags.push(`<title>${escapeHtml(seo.title)}</title>`)
  tags.push(`<meta name="description" content="${escapeHtml(seo.description)}" />`)

  if (seo.keywords) {
    tags.push(`<meta name="keywords" content="${escapeHtml(seo.keywords)}" />`)
  }

  // Canonical URL
  if (seo.canonical) {
    tags.push(`<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`)
  }

  // Robots directive
  if (seo.noindex) {
    tags.push(`<meta name="robots" content="noindex, nofollow" />`)
  } else {
    tags.push(`<meta name="robots" content="index, follow" />`)
  }

  // Open Graph tags
  tags.push(`<meta property="og:title" content="${escapeHtml(seo.title)}" />`)
  tags.push(`<meta property="og:description" content="${escapeHtml(seo.description)}" />`)
  tags.push(`<meta property="og:type" content="${seo.ogType || "website"}" />`)

  if (seo.canonical) {
    tags.push(`<meta property="og:url" content="${escapeHtml(seo.canonical)}" />`)
  }

  if (seo.ogImage) {
    tags.push(`<meta property="og:image" content="${escapeHtml(seo.ogImage)}" />`)
    tags.push(`<meta property="og:image:width" content="1200" />`)
    tags.push(`<meta property="og:image:height" content="630" />`)
  }

  tags.push(`<meta property="og:site_name" content="PromptInk" />`)

  // Twitter Card tags
  tags.push(`<meta name="twitter:card" content="${seo.twitterCard || "summary_large_image"}" />`)
  tags.push(`<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`)
  tags.push(`<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`)

  if (seo.ogImage) {
    tags.push(`<meta name="twitter:image" content="${escapeHtml(seo.ogImage)}" />`)
  }

  return tags.join("\n    ")
}

// Generate JSON-LD structured data
export function generateStructuredData(seo: SEOConfig, pathname: string): string {
  const baseData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "PromptInk",
    "description": defaultSEO.description,
    "url": config.server.baseUrl,
    "applicationCategory": "DesignApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
    },
  }

  // For share pages, add ImageObject schema
  if (pathname.startsWith("/share/")) {
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ImageObject",
      "name": seo.title,
      "description": seo.description,
      "contentUrl": seo.ogImage,
      "creator": {
        "@type": "Organization",
        "name": "PromptInk",
      },
    })
  }

  return JSON.stringify(baseData)
}

// Escape HTML special characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// Generate sitemap XML
export function generateSitemap(): string {
  const baseUrl = config.server.baseUrl
  const now = new Date().toISOString().split("T")[0]

  const staticPages = [
    { url: "/", priority: "1.0", changefreq: "daily" },
    { url: "/login", priority: "0.6", changefreq: "monthly" },
    { url: "/register", priority: "0.6", changefreq: "monthly" },
    { url: "/purchase", priority: "0.7", changefreq: "weekly" },
  ]

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`

  for (const page of staticPages) {
    xml += `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`
  }

  xml += `</urlset>`
  return xml
}

// Generate robots.txt content
export function generateRobotsTxt(): string {
  const baseUrl = config.server.baseUrl
  return `# PromptInk Robots.txt
User-agent: *
Allow: /
Allow: /login
Allow: /register
Allow: /purchase
Allow: /share/

Disallow: /admin
Disallow: /settings
Disallow: /api/
Disallow: /assets/

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml
`
}
