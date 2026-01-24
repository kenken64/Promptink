# PromptInk Architecture

## Overview

PromptInk is a full-stack application that generates AI images using OpenAI's DALL-E 3 and syncs them to TRMNL e-ink displays. The application features JWT authentication, per-user settings, SQLite persistence, a complete e-commerce system with Razorpay payment integration, subscription management, social sharing, an image gallery, infographic generation from GitHub repositories, and an admin dashboard for data management.

**Components:**
1. **Backend** - Bun API server with SQLite database
2. **Frontend** - React-based chat interface with voice input support
3. **trmnl-plugin** - TRMNL plugin for displaying synced images on e-ink devices
4. **E-commerce** - Device purchases and subscriptions via Razorpay
5. **Admin Dashboard** - Data export/import, user management, and URL migration

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PromptInk System                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐      ┌──────────────────┐      ┌───────────────────────┐  │
│  │              │      │                  │      │                       │  │
│  │   Frontend   │◄────►│     Backend      │◄────►│   OpenAI DALL-E 3     │  │
│  │   (React)    │      │     (Bun)        │      │                       │  │
│  │              │      │                  │      └───────────────────────┘  │
│  └──────────────┘      └────────┬─────────┘                                 │
│         │                       │                                           │
│         │              ┌────────┴─────────┐                                 │
│         │              │                  │                                 │
│         │              │   SQLite DB      │                                 │
│         │              │   - users        │                                 │
│         │              │   - synced_images│                                 │
│         │              │   - orders       │                                 │
│         │              │   - gallery      │                                 │
│         │              │   - shared_images│                                 │
│         │              │   - sessions     │                                 │
│         │              │                  │                                 │
│         │              └────────┬─────────┘                                 │
│         │                       │                                           │
│         │      ┌────────────────┼────────────────┐                          │
│         │      │                │                │                          │
│         │      ▼                ▼                ▼                          │
│         │ ┌──────────┐    ┌──────────┐    ┌──────────────┐                  │
│         │ │ Razorpay │    │ TRMNL    │    │ Per-User     │                  │
│         │ │   API    │    │  API     │    │ Image Store  │                  │
│         │ └──────────┘    └────┬─────┘    └──────────────┘                  │
│         │                      │                                            │
│         │              /api/trmnl/webhook/:userId                           │
│         │                      │                                            │
│         │              ┌───────┴────────┐                                   │
│         │              │                │                                   │
│         └─────────────►│  TRMNL Device  │                                   │
│          Sync Image    │  (E-ink)       │                                   │
│                        │                │                                   │
│                        └────────────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
PromptInk/
├── backend/                    # Bun API server
│   ├── src/
│   │   ├── config/            # Environment configuration
│   │   │   └── index.ts
│   │   ├── db/                # Database layer
│   │   │   └── index.ts       # SQLite setup, tables, queries
│   │   ├── middleware/        # Express-style middleware
│   │   │   └── auth.ts        # JWT authentication middleware
│   │   ├── routes/            # API route handlers
│   │   │   ├── index.ts       # Route aggregation
│   │   │   ├── admin.ts       # Admin dashboard endpoints
│   │   │   ├── auth.ts        # Authentication endpoints
│   │   │   ├── settings.ts    # User settings endpoints
│   │   │   ├── display.ts     # Display endpoints
│   │   │   ├── plugins.ts     # Plugin management
│   │   │   ├── device.ts      # Device info
│   │   │   ├── images.ts      # Image generation + infographic
│   │   │   ├── sync.ts        # TRMNL sync & webhook
│   │   │   ├── share.ts       # Social sharing
│   │   │   ├── gallery.ts     # Image gallery
│   │   │   ├── suggestions.ts # AI-generated prompt suggestions
│   │   │   ├── orders.ts      # Order management
│   │   │   ├── subscription.ts    # Subscription management
│   │   │   ├── schedule.ts        # Scheduled jobs CRUD
│   │   │   ├── batch.ts           # Batch image generation
│   │   │   └── razorpay-webhook.ts # Payment webhooks
│   │   ├── services/          # Business logic
│   │   │   ├── index.ts
│   │   │   ├── auth-service.ts    # JWT, password hashing
│   │   │   ├── trmnl-service.ts
│   │   │   ├── openai-service.ts
│   │   │   ├── image-store.ts
│   │   │   ├── order-service.ts
│   │   │   ├── subscription-service.ts
│   │   │   ├── razorpay-service.ts
│   │   │   ├── scheduler-service.ts # Background job scheduler
│   │   │   ├── batch-service.ts     # Batch image generation
│   │   │   └── repomix-service.ts   # GitHub repo summarization
│   │   ├── utils/             # Utility functions
│   │   │   ├── index.ts
│   │   │   └── logger.ts
│   │   └── index.ts           # Main server entry
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   │   ├── ui/            # shadcn/ui base components
│   │   │   ├── AuthGuard.tsx  # Protected route wrapper
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   ├── LanguageToggle.tsx
│   │   │   ├── ShareButton.tsx    # Social sharing button
│   │   │   ├── GalleryCard.tsx    # Gallery image card
│   │   │   └── ImageDetailModal.tsx # Full image modal
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── index.ts
│   │   │   ├── useAuth.ts         # Authentication state
│   │   │   ├── useImageGeneration.ts
│   │   │   ├── useTheme.ts
│   │   │   ├── useSpeechToText.ts
│   │   │   ├── useLanguage.ts
│   │   │   ├── useTrmnlSync.ts
│   │   │   ├── useOrders.ts
│   │   │   ├── useSubscription.ts
│   │   │   ├── useGallery.ts      # Gallery state management
│   │   │   └── useSuggestions.ts  # AI-generated suggestions
│   │   ├── pages/             # Page components
│   │   │   ├── AdminPage.tsx      # Admin dashboard
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── PurchasePage.tsx
│   │   │   ├── SubscriptionPage.tsx
│   │   │   ├── OrdersPage.tsx
│   │   │   └── GalleryPage.tsx    # Image gallery page
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── index.html
│   └── package.json
│
├── trmnl-plugin/           # TRMNL plugin
│   ├── src/
│   │   ├── full.liquid        # Full screen layout
│   │   ├── half_horizontal.liquid
│   │   ├── half_vertical.liquid
│   │   ├── quadrant.liquid
│   │   ├── shared.liquid
│   │   └── settings.yml       # Plugin configuration
│   ├── bin/
│   │   └── trmnlp            # CLI wrapper
│   └── .trmnlp.yml
│
├── k6/                        # Performance testing
│   ├── scripts/
│   │   ├── load-test.js       # Load/stress tests
│   │   ├── api-tests.js       # API endpoint tests
│   │   └── authenticated-tests.js # Auth endpoint tests
│   ├── grafana-dashboard.json # Grafana dashboard
│   └── README.md
│
├── scripts/                   # Management scripts
│   ├── start.sh              # Start all services
│   ├── stop.sh               # Stop all services
│   ├── install.sh            # Install dependencies
│   ├── start-backend.sh
│   ├── stop-backend.sh
│   ├── start-trmnl.sh
│   ├── stop-trmnl.sh
│   └── status.sh
│
├── .github/workflows/         # CI/CD
│   ├── ci.yml                # Main CI pipeline
│   └── performance.yml       # K6 performance tests
│
├── data/                      # SQLite database (gitignored)
│   └── promptink.db
│
├── logs/                      # Application logs
│   ├── backend.log
│   └── trmnl.log
│
├── Dockerfile                 # Docker deployment
├── railway.toml              # Railway deployment config
├── .env.example              # Environment template
├── ARCHITECTURE.md           # This file
├── README.md                 # Project readme
└── claude.md                 # Claude Code rules
```

---

## Design Decisions

### 1. DALL-E Image URL Expiration Solution

**Problem**: DALL-E image URLs expire after approximately 1 hour. When we store the original DALL-E URL and send it to TRMNL, the image works initially but becomes a broken link after the URL expires.

**Solution**: Store physical image files on the server with permanent URLs.

**Implementation**:
1. When a user syncs an image, the backend downloads the image from the DALL-E URL
2. The image is saved as a physical file: `/app/data/images/user_{userId}.png`
3. One image per user (overwrites on each sync to save storage)
4. A dedicated endpoint serves the image: `/api/images/synced/{userId}`
5. The permanent URL (e.g., `https://promptink-production.up.railway.app/api/images/synced/1`) is sent to TRMNL
6. Images are stored on Railway's persistent volume at `/app/data`

**Code location**: `backend/src/routes/sync.ts`

```typescript
// Download image from URL and save to file
async function downloadAndSaveImage(imageUrl: string, userId: number): Promise<string> {
  const response = await fetch(imageUrl)
  const arrayBuffer = await response.arrayBuffer()
  const filePath = `/app/data/images/user_${userId}.png`
  await Bun.write(filePath, arrayBuffer)
  return filePath
}

// Get the public URL for a user's synced image
function getUserImageUrl(userId: number): string {
  return `${config.server.baseUrl}/api/images/synced/${userId}`
}
```

### 2. TRMNL Integration Strategy

**Strategy**: Webhook (push-based) with polling fallback

The backend pushes image data to TRMNL's custom plugin webhook API when syncing. This provides immediate updates to the device. The Liquid templates in `trmnl-plugin/src/` define how images are displayed.

**Webhook endpoint**: `POST https://usetrmnl.com/api/custom_plugins/{plugin_uuid}`

**Template Variables**:
- `has_image` - Boolean indicating if an image is synced
- `image_url` - Permanent URL to the synced image
- `prompt` - Original generation prompt
- `background_color` - User's preferred background (#000 or #fff)
- `updated_at` - Timestamp of last sync

### 3. Image Format Handling

**Problem**: DALL-E image edit API only accepts PNG format with specific MIME type.

**Solution**: Frontend converts all images to PNG using HTML Canvas before upload.

**Code location**: `frontend/src/components/ChatInput.tsx`

### 4. Multi-language Support

**Problem**: DALL-E 3 always returns `revised_prompt` in English, even when the input was in Chinese.

**Solution**: When the user's language is Chinese, the backend translates the `revised_prompt` back to Chinese using GPT-4o-mini.

**Code location**: `backend/src/routes/images.ts`, `backend/src/services/openai-service.ts`

### 5. Payment & E-commerce System

**Solution**: Razorpay integration for device purchases and subscriptions.

**Implementation**:
- **Orders**: Users can purchase TRMNL devices ($120/unit)
- **Subscriptions**: Monthly subscription plan ($6.53/month incl. GST) managed via Razorpay
- **Webhooks**: Razorpay webhook endpoint for payment/subscription events
- **Idempotency**: Webhook events are deduplicated using event IDs

**Code locations**:
- `backend/src/services/razorpay-service.ts` - Razorpay API integration
- `backend/src/services/order-service.ts` - Order management
- `backend/src/services/subscription-service.ts` - Subscription logic
- `backend/src/routes/razorpay-webhook.ts` - Webhook handler

### 6. Social Sharing

**Solution**: Permanent shareable links with social media integration and Open Graph meta tags.

**Implementation**:
- Images are stored with unique share IDs in `/app/data/images/shared/`
- Share page includes Open Graph and Twitter Card meta tags for rich previews
- Pre-generated social share links for Twitter, Facebook, LinkedIn, Telegram, Pinterest, WhatsApp
- View count tracking for shared images
- Optional expiration dates for shares

**Code locations**:
- `backend/src/routes/share.ts` - Share API endpoints and share page
- `frontend/src/components/ShareButton.tsx` - Share UI component

### 7. Image Gallery / History

**Problem**: Users want to view and manage their previously generated images.

**Solution**: Auto-save all generated images to a gallery with full browsing, search, and management capabilities.

**Implementation**:
- Images are automatically saved to the gallery when generated (for authenticated users)
- Stored in `/app/data/images/gallery/user_{userId}/{imageId}.png`
- Gallery supports pagination, search by prompt, and favorites filtering
- Images can be favorited, deleted (soft delete), and shared
- Full metadata preserved: prompt, revised prompt, model, size, style

**Features**:
- Responsive grid layout (2-5 columns based on screen size)
- Infinite scroll with "Load More" pagination
- Search by prompt text
- Filter by favorites
- Keyboard navigation in detail modal (arrows, escape)
- Toggle favorite status
- **Export/Download images with format conversion** (PNG, JPG, WebP)
- Share images (integrates with social sharing)
- Soft delete with confirmation
- Image metadata display (prompt, model, size, date)
- Visual badges for favorited and edited images

### 8. Image Export with Format Conversion

**Problem**: Users want to download images in different formats for various use cases (web, print, sharing).

**Solution**: Server-side image format conversion using Sharp library with quality controls.

**Implementation**:
- Backend uses [Sharp](https://sharp.pixelplumbing.com/) library for high-performance image processing
- Export endpoint: `GET /api/gallery/export/:id?format=png|jpg|webp&quality=1-100`
- Frontend provides dropdown menu with format options in image detail modal

**Supported Formats**:
| Format | Content-Type | Use Case |
|--------|--------------|----------|
| PNG | image/png | Best quality, lossless compression |
| JPG | image/jpeg | Smaller file size, good for photos |
| WebP | image/webp | Smallest file size, modern format |

**API Parameters**:
- `format` - Output format: `png`, `jpg`, or `webp` (default: `png`)
- `quality` - Compression quality: 1-100 (default: 85, applies to JPG/WebP)
- `width` / `height` - Optional resize dimensions (maintains aspect ratio)

### 9. Image Style Presets

**Problem**: Users want to apply consistent visual styles without manually describing them in every prompt.

**Solution**: Predefined style presets that automatically append style modifiers to prompts.

**Implementation**:
- Backend defines style preset mappings with prompt modifiers
- Frontend provides dropdown selector with 11 style options
- Selected style is sent with the generation request
- Prompt is enhanced server-side before sending to DALL-E 3

**Available Styles**:
| Style | Description |
|-------|-------------|
| None | No style modification (default) |
| Photorealistic | High-resolution photography style |
| Anime | Japanese animation/manga style |
| Watercolor | Traditional watercolor painting |
| Oil Painting | Classical oil painting technique |
| Pixel Art | Retro 8-bit/16-bit game style |
| 3D Render | Modern CGI/Blender-style rendering |
| Sketch | Pencil/charcoal drawing |
| Pop Art | Bold colors, comic book style |
| Minimalist | Clean lines, simple shapes |
| Cinematic | Movie poster, dramatic lighting |

**Code locations**:
- `backend/src/routes/images.ts` - Style preset definitions and prompt modification
- `frontend/src/App.tsx` - Style selector UI
- `frontend/src/hooks/useImageGeneration.ts` - Style parameter in API call
- `frontend/src/hooks/useLanguage.ts` - Translations for EN/ZH

### 10. Scheduled Image Generation

**Problem**: Users want to automate image generation at specific times without manually triggering each request.

**Solution**: Background scheduler service that executes scheduled jobs with support for once, daily, and weekly schedules.

**Implementation**:
- **Database**: `scheduled_jobs` table stores job configurations with schedule type, time, days, and next run time
- **Scheduler Service**: Background interval (60s) checks for due jobs and executes them
- **Schedule Types**:
  - `once` - Single execution at a specific datetime
  - `daily` - Runs every day at a specified time (HH:MM)
  - `weekly` - Runs on specific days of the week at a specified time
- **Features**:
  - Timezone support for accurate scheduling across regions
  - Auto-sync to TRMNL option for generated images
  - Style presets support for consistent styling
  - Toggle enable/disable without deleting jobs
  - Maximum 10 jobs per user to prevent abuse
- **Next Run Calculation**: When a job completes, the next run time is calculated based on schedule type

**Flow**:
```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│   Scheduler     │───►│  Check Due Jobs  │───►│ Execute Job       │
│ (60s interval)  │    │  (next_run <= now)│    │ - Generate image  │
└─────────────────┘    └──────────────────┘    │ - Save to gallery │
                                               │ - Sync to TRMNL?  │
                                               │ - Update next_run │
                                               └───────────────────┘
```

**Code locations**:
- `backend/src/db/index.ts` - `scheduled_jobs` table and queries
- `backend/src/services/scheduler-service.ts` - Background scheduler logic
- `backend/src/routes/schedule.ts` - CRUD API endpoints
- `frontend/src/pages/SchedulePage.tsx` - Schedule management UI
- `frontend/src/hooks/useSchedule.ts` - Frontend API hook

---

### 11. Batch Image Generation

**Problem**: Users want to generate multiple images from different prompts in a single session without manually triggering each one.

**Solution**: Batch job system with queue-based processing that generates images sequentially to respect OpenAI rate limits.

**Implementation**:
- **Database**: 
  - `batch_jobs` table stores batch job metadata (user, status, progress counts, settings)
  - `batch_job_items` table stores individual prompts and their results
- **Batch Processor**: Background interval (5s) picks up pending batches and processes one item at a time
- **Features**:
  - Multiple prompts per batch (max 10 to control costs/time)
  - Progress tracking with real-time polling
  - Auto-sync each generated image to TRMNL option
  - Style presets apply to all images in batch
  - Size selection (square, landscape, portrait)
  - Cancel in-progress batches
  - View individual item results with image thumbnails
- **Status Tracking**:
  - Batch: pending → processing → completed/failed/cancelled
  - Items: pending → processing → completed/failed

**Flow**:
```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│   Create Batch  │───►│  Queue Items     │───►│  Batch Processor  │
│  (POST /batch)  │    │  (N prompts)     │    │  (5s interval)    │
└─────────────────┘    └──────────────────┘    └─────────┬─────────┘
                                                         │
                       ┌─────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  For each pending item:                                         │
│  1. Apply style preset to prompt                                │
│  2. Generate image via DALL-E 3                                 │
│  3. Save to gallery                                             │
│  4. Auto-sync to TRMNL (if enabled)                             │
│  5. Update item status + batch progress                         │
│  6. Mark batch complete when all items done                     │
└─────────────────────────────────────────────────────────────────┘
```

**Code locations**:
- `backend/src/db/index.ts` - `batch_jobs` and `batch_job_items` tables and queries
- `backend/src/services/batch-service.ts` - Batch processor and job management
- `backend/src/routes/batch.ts` - CRUD API endpoints with status polling
- `frontend/src/pages/BatchPage.tsx` - Batch creation and monitoring UI
- `frontend/src/hooks/useBatch.ts` - Frontend API hook with polling support

---

### 12. Admin Dashboard with Data Export/Import

**Problem**: Administrators need to backup application data, migrate between servers, and manage users without direct database access.

**Solution**: Password-protected admin dashboard with ZIP-based data export/import and user management.

**Implementation**:
- **Admin Authentication**: Custom JWT implementation with separate admin password
- **Data Export**: Recursively collects all files from `/app/data` directory into a ZIP file
- **Data Import**: Accepts ZIP upload, extracts and restores files to `/app/data`
- **User Management**: Paginated user list with subscription status badges
- **Stats Dashboard**: Real-time counts for users, images, orders, and subscriptions

**Features**:
- ZIP creation implemented natively (no external dependencies)
- CRC-32 validation for data integrity
- Progress tracking with MB display for upload/download
- Blocking overlay during operations to prevent concurrent actions
- Retro flip-counter UI for statistics display

**Flow**:
```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│   Admin Login   │───►│  Verify Password │───►│  Generate JWT     │
│  (POST /login)  │    │                  │    │  (admin-specific) │
└─────────────────┘    └──────────────────┘    └───────────────────┘

┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│   Export Data   │───►│  Collect Files   │───►│  Create ZIP       │
│  (GET /export)  │    │  from /app/data  │    │  (stored format)  │
└─────────────────┘    └──────────────────┘    └───────────────────┘

┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│   Import Data   │───►│  Parse ZIP       │───►│  Restore Files    │
│  (POST /import) │    │  entries         │    │  + URL Migration  │
└─────────────────┘    └──────────────────┘    └───────────────────┘
```

**Code locations**:
- `backend/src/routes/admin.ts` - Admin endpoints, ZIP implementation, URL migration
- `backend/src/config/index.ts` - Admin password and JWT secret configuration
- `frontend/src/pages/AdminPage.tsx` - Admin dashboard UI with progress tracking

---

### 13. URL Migration for Database Import

**Problem**: When migrating data between servers, image URLs stored in the database still reference the old server domain.

**Solution**: Automatic URL replacement during data import that updates all image URLs to the new server domain.

**Implementation**:
- Accepts old URL and new URL parameters during import
- Updates three database tables using SQL REPLACE:
  - `generated_images.image_url`
  - `synced_images.image_url`
  - `orders.tracking_url` (with error handling for missing column)
- Returns count of updated records for transparency

**Usage**:
1. Export data from old server
2. Import ZIP on new server
3. Provide old server URL (e.g., `https://old-server.railway.app`)
4. Provide new server URL (e.g., `https://new-server.railway.app`)
5. All image URLs are automatically updated

**Code locations**:
- `backend/src/routes/admin.ts` - `migrateUrls()` function (lines 357-387)
- `frontend/src/pages/AdminPage.tsx` - URL migration input fields

---

### 14. Infographic Generation with Repomix

**Problem**: Users want to create visual infographics from text content or GitHub repositories without manually summarizing the content.

**Solution**: Integration with Repomix to summarize GitHub repositories, combined with GPT-4 for prompt generation and DALL-E 3 for image creation.

**Implementation**:
- **Repomix Integration**: Executes `npx repomix --remote <url> --style markdown` to summarize repositories
- **Smart URL Detection**: Distinguishes between full repository URLs and file URLs
  - Repository URLs: Uses Repomix for comprehensive summarization
  - File URLs (blob): Direct fetch of markdown content
- **GPT-4 Prompt Generation**: Converts content into DALL-E-friendly infographic prompts
- **Wide Format Output**: Generates 1792x1024 images optimized for infographics

**Flow**:
```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│   User Input    │───►│  Detect Type     │───►│  GitHub Repo?     │
│  (URL or text)  │    │  (repo vs file)  │    │                   │
└─────────────────┘    └──────────────────┘    └─────────┬─────────┘
                                                         │
                       ┌─────────────────────────────────┴──────────┐
                       │                                            │
                       ▼                                            ▼
              ┌────────────────┐                          ┌────────────────┐
              │  Repomix       │                          │  Direct Fetch  │
              │  (summarize)   │                          │  (markdown)    │
              └───────┬────────┘                          └───────┬────────┘
                      │                                           │
                      └─────────────────┬─────────────────────────┘
                                        ▼
                              ┌────────────────┐
                              │  GPT-4         │
                              │  (gen prompt)  │
                              └───────┬────────┘
                                      ▼
                              ┌────────────────┐
                              │  DALL-E 3      │
                              │  (1792x1024)   │
                              └────────────────┘
```

**Usage Examples**:
- "infographic about https://github.com/user/repo" - Summarizes entire repo
- Direct GitHub .md URL - Fetches and visualizes markdown content
- "infographic about machine learning concepts" - Text-based infographic

**Code locations**:
- `backend/src/services/repomix-service.ts` - GitHub repo summarization via Repomix
- `backend/src/services/openai-service.ts` - `isGitHubRepoUrl()` and `fetchUrlContent()` helpers
- `backend/src/routes/images.ts` - `/api/images/infographic` endpoint
- `frontend/src/App.tsx` - `isInfographicRequest()` detection and routing

---

## Database Schema

### users table

| Column                          | Type     | Description                              |
|---------------------------------|----------|------------------------------------------|
| id                              | INTEGER  | Primary key                              |
| email                           | TEXT     | Unique email address                     |
| password_hash                   | TEXT     | Argon2id hashed password                 |
| name                            | TEXT     | User's display name                      |
| trmnl_device_api_key            | TEXT     | TRMNL API key for device access          |
| trmnl_mac_address               | TEXT     | Device MAC address                       |
| trmnl_background_color          | TEXT     | Preferred background (black/white)       |
| razorpay_customer_id            | TEXT     | Razorpay customer ID                     |
| subscription_id                 | TEXT     | Active subscription ID                   |
| subscription_status             | TEXT     | none/active/paused/cancelled/past_due    |
| subscription_current_period_end | DATETIME | Current billing period end date          |
| first_order_id                  | INTEGER  | Reference to first completed order       |
| created_at                      | DATETIME | Account creation timestamp               |
| updated_at                      | DATETIME | Last update timestamp                    |

### orders table

| Column                  | Type     | Description                              |
|-------------------------|----------|------------------------------------------|
| id                      | INTEGER  | Primary key                              |
| user_id                 | INTEGER  | Foreign key to users table               |
| order_number            | TEXT     | Unique order number (ORD-YYYYMMDD-XXXX)  |
| razorpay_order_id       | TEXT     | Razorpay order ID                        |
| razorpay_payment_id     | TEXT     | Razorpay payment ID                      |
| quantity                | INTEGER  | Number of devices                        |
| unit_price              | INTEGER  | Price per unit in cents                  |
| total_amount            | INTEGER  | Total order amount in cents              |
| currency                | TEXT     | Currency code (USD)                      |
| status                  | TEXT     | pending/paid/processing/shipped/delivered/cancelled |
| shipping_*              | TEXT     | Shipping address fields                  |
| is_gift                 | INTEGER  | Gift order flag                          |
| gift_recipient_name     | TEXT     | Gift recipient name                      |
| gift_message            | TEXT     | Gift message                             |
| tracking_number         | TEXT     | Shipment tracking number                 |
| carrier                 | TEXT     | Shipping carrier                         |
| tracking_url            | TEXT     | Tracking URL                             |
| created_at              | DATETIME | Order creation timestamp                 |
| paid_at                 | DATETIME | Payment timestamp                        |
| shipped_at              | DATETIME | Shipment timestamp                       |
| delivered_at            | DATETIME | Delivery timestamp                       |

### order_devices table

| Column            | Type     | Description                              |
|-------------------|----------|------------------------------------------|
| id                | INTEGER  | Primary key                              |
| order_id          | INTEGER  | Foreign key to orders table              |
| serial_number     | TEXT     | Device serial number                     |
| mac_address       | TEXT     | Device MAC address                       |
| activation_status | TEXT     | pending/activated                        |
| activated_at      | DATETIME | Activation timestamp                     |

### synced_images table

| Column     | Type     | Description                              |
|------------|----------|------------------------------------------|
| id         | INTEGER  | Primary key                              |
| user_id    | INTEGER  | Foreign key to users table               |
| image_url  | TEXT     | Permanent URL to stored image            |
| prompt     | TEXT     | Original generation prompt               |
| synced_at  | DATETIME | Timestamp of sync                        |

### shared_images table

| Column     | Type     | Description                              |
|------------|----------|------------------------------------------|
| id         | INTEGER  | Primary key                              |
| share_id   | TEXT     | Unique share identifier (16 hex chars)   |
| user_id    | INTEGER  | Foreign key to users table               |
| image_url  | TEXT     | Permanent URL to stored image            |
| prompt     | TEXT     | Original generation prompt               |
| created_at | DATETIME | Share creation timestamp                 |
| expires_at | DATETIME | Optional expiration timestamp            |
| view_count | INTEGER  | Number of times share page was viewed    |

### generated_images table

| Column          | Type     | Description                              |
|-----------------|----------|------------------------------------------|
| id              | INTEGER  | Primary key                              |
| user_id         | INTEGER  | Foreign key to users table               |
| image_url       | TEXT     | Permanent URL to stored image            |
| original_prompt | TEXT     | User's original prompt                   |
| revised_prompt  | TEXT     | DALL-E's revised prompt                  |
| model           | TEXT     | Model used (dall-e-3, dall-e-2)          |
| size            | TEXT     | Image size (1024x1024, etc.)             |
| style           | TEXT     | Style option (vivid, natural)            |
| is_edit         | INTEGER  | 1 if image was edited, 0 otherwise       |
| parent_image_id | INTEGER  | Reference to original image if edited    |
| is_favorite     | INTEGER  | 1 if marked as favorite                  |
| is_deleted      | INTEGER  | 1 if soft deleted                        |
| created_at      | DATETIME | Generation timestamp                     |

### sessions table

| Column     | Type     | Description                              |
|------------|----------|------------------------------------------|
| id         | INTEGER  | Primary key                              |
| user_id    | INTEGER  | Foreign key to users table               |
| token_hash | TEXT     | Hashed refresh token                     |
| expires_at | DATETIME | Token expiration timestamp               |
| created_at | DATETIME | Session creation timestamp               |

### scheduled_jobs table

| Column          | Type     | Description                              |
|-----------------|----------|------------------------------------------|
| id              | INTEGER  | Primary key                              |
| user_id         | INTEGER  | Foreign key to users table               |
| prompt          | TEXT     | Image generation prompt                  |
| size            | TEXT     | Image size (1024x1024, etc.)             |
| style_preset    | TEXT     | Style preset (photorealistic, anime, etc.)|
| schedule_type   | TEXT     | once/daily/weekly                        |
| schedule_time   | TEXT     | Time in HH:MM format (for daily/weekly)  |
| schedule_days   | TEXT     | JSON array of day indices 0-6 (for weekly)|
| scheduled_at    | DATETIME | Specific datetime (for once)             |
| timezone        | TEXT     | User's timezone (e.g., Asia/Kolkata)     |
| is_enabled      | INTEGER  | 1 if job is active, 0 if paused          |
| auto_sync_trmnl | INTEGER  | 1 to auto-sync generated images to TRMNL |
| last_run_at     | DATETIME | Timestamp of last execution              |
| next_run_at     | DATETIME | Calculated next run timestamp            |
| run_count       | INTEGER  | Total number of successful runs          |
| created_at      | DATETIME | Job creation timestamp                   |
| updated_at      | DATETIME | Last modification timestamp              |

### batch_jobs table

| Column          | Type     | Description                              |
|-----------------|----------|------------------------------------------|
| id              | INTEGER  | Primary key                              |
| user_id         | INTEGER  | Foreign key to users table               |
| name            | TEXT     | Optional batch name/description          |
| status          | TEXT     | pending/processing/completed/failed/cancelled |
| total_count     | INTEGER  | Total number of prompts in batch         |
| completed_count | INTEGER  | Number of successfully generated images  |
| failed_count    | INTEGER  | Number of failed generations             |
| size            | TEXT     | Image size for all items (1024x1024, etc.)|
| style_preset    | TEXT     | Style preset for all items               |
| auto_sync_trmnl | INTEGER  | 1 to auto-sync each image to TRMNL       |
| created_at      | DATETIME | Batch creation timestamp                 |
| started_at      | DATETIME | When processing started                  |
| completed_at    | DATETIME | When batch finished (success or fail)    |

### batch_job_items table

| Column          | Type     | Description                              |
|-----------------|----------|------------------------------------------|
| id              | INTEGER  | Primary key                              |
| batch_id        | INTEGER  | Foreign key to batch_jobs table          |
| prompt          | TEXT     | Image generation prompt                  |
| status          | TEXT     | pending/processing/completed/failed      |
| image_id        | INTEGER  | Foreign key to generated_images (if success)|
| error_message   | TEXT     | Error message if generation failed       |
| created_at      | DATETIME | Item creation timestamp                  |
| completed_at    | DATETIME | When item finished processing            |

---

## Authentication Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │    │ Frontend │    │ Backend  │    │ Database │
│          │    │          │    │          │    │          │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │               │
     │ Register/Login│               │               │
     │──────────────►│               │               │
     │               │  POST /auth   │               │
     │               │──────────────►│               │
     │               │               │  Verify/Create│
     │               │               │──────────────►│
     │               │               │◄──────────────│
     │               │  JWT Token    │               │
     │               │◄──────────────│               │
     │  Store Token  │               │               │
     │◄──────────────│               │               │
     │               │               │               │
     │ Protected Req │               │               │
     │──────────────►│               │               │
     │               │ Authorization │               │
     │               │ Bearer <token>│               │
     │               │──────────────►│               │
     │               │               │ Verify JWT    │
     │               │               │──────────────►│
     │               │  Response     │               │
     │◄──────────────│◄──────────────│               │
```

### JWT Structure

```json
{
  "userId": 1,
  "email": "user@example.com",
  "iat": 1704844800,
  "exp": 1705449600
}
```

### Password Hashing

- Algorithm: Argon2id (via `Bun.password.hash()`)
- Memory cost: 65536 KB
- Time cost: 2 iterations

---

## Data Flow

### Image Generation Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │    │ Frontend │    │ Backend  │    │  OpenAI  │    │ Frontend │
│  Input   │───►│  React   │───►│   Bun    │───►│ DALL-E 3 │───►│ Display  │
│  Prompt  │    │          │    │          │    │          │    │  Image   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │                                                               │
     │              Voice Input (OpenAI Whisper)                     │
     └───────────────────────────────────────────────────────────────┘
```

**Steps:**
1. User enters prompt (text or voice)
2. Frontend sends POST to `/api/images/generate` with JWT token
3. Backend validates token, calls OpenAI DALL-E 3 API
4. If Chinese language, backend translates revised_prompt
5. Image auto-saved to gallery (for authenticated users)
6. Frontend displays the generated image

### TRMNL Sync Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │    │ Frontend │    │ Backend  │    │  TRMNL   │    │  E-ink   │
│  Clicks  │───►│  Sync    │───►│  Store   │◄───│  Server  │───►│ Display  │
│  Sync    │    │  Button  │    │  to DB   │    │  (Poll)  │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                     │
                          /api/trmnl/webhook/:userId
                                     │
                          (Per-user webhook URL)
```

**Steps:**
1. User clicks "Sync to TRMNL" button
2. Frontend sends POST to `/api/sync/trmnl` with image URL (auth required)
3. Backend downloads image from DALL-E URL
4. Backend saves image to persistent storage
5. Backend stores reference in SQLite database
6. Backend pushes permanent URL to TRMNL webhook API
7. TRMNL device displays the image on next refresh

### Social Share Flow

1. User clicks "Share" button on a generated image
2. Frontend calls `/api/share/create` with image URL and prompt
3. Backend downloads image and saves with unique share ID
4. Backend returns share URL and pre-built social media links
5. User clicks a social platform or copies the link
6. Recipients see rich preview with image when link is shared
7. Clicking link opens share page with image and CTA

### Gallery Auto-Save Flow

1. User generates or edits an image
2. Backend receives image from DALL-E API
3. If user is authenticated:
   - Backend creates gallery record in database
   - Backend downloads image and saves to `/app/data/images/gallery/user_{userId}/{imageId}.png`
   - Response includes `galleryId` and `galleryUrl` for reference
4. Image is now available in user's gallery

### Purchase Flow

1. User fills out purchase form (quantity, shipping details)
2. Frontend creates order via `/api/orders`
3. Backend creates Razorpay order
4. Frontend opens Razorpay checkout modal
5. User completes payment
6. Razorpay webhook notifies backend (`payment.captured`)
7. Backend marks order as paid
8. If first order, subscription is activated

### Subscription Flow

1. First purchase triggers subscription creation OR user can subscribe directly
2. Razorpay handles recurring billing ($6.53/month incl. GST)
3. Webhook events update subscription status:
   - `subscription.activated` - Subscription starts
   - `subscription.charged` - Monthly renewal
   - `subscription.cancelled` - User cancelled
   - `subscription.paused` - Payment paused
   - `subscription.pending` / `payment.failed` - Past due

---

## API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login user |
| GET | `/api/auth/me` | Yes | Get current user info |
| POST | `/api/auth/logout` | Yes | Logout user |
| POST | `/api/auth/refresh` | No | Refresh access token |

### Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/admin/login` | No | Admin login with password |
| GET | `/api/admin/verify` | Admin | Verify admin token |
| GET | `/api/admin/stats` | Admin | Get dashboard statistics |
| GET | `/api/admin/users` | Admin | List users (paginated) |
| GET | `/api/admin/export` | Admin | Export data as ZIP |
| POST | `/api/admin/import` | Admin | Import data from ZIP |

**Import Parameters (multipart/form-data):**
- `file` - ZIP file to import
- `oldUrl` - Optional: Old server URL for migration
- `newUrl` - Optional: New server URL for migration

### User Settings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/settings` | Yes | Get user settings |
| PUT | `/api/settings` | Yes | Update user settings |

### Image Generation

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/images/generate` | Yes | Generate image from prompt |
| POST | `/api/images/edit` | Yes | Edit existing image |
| POST | `/api/images/infographic` | Optional | Generate infographic from content/URL |
| GET | `/api/images/synced/:userId` | No | Serve synced image file |

**Infographic Parameters:**
- `content` - Text/markdown content to visualize
- `url` - GitHub URL (repo or file) to summarize and visualize

### TRMNL Sync

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/sync/trmnl` | Yes | Store image for TRMNL sync |
| GET | `/api/trmnl/webhook/:userId` | No | Webhook for TRMNL polling |
| GET | `/api/sync/status` | Yes | Check sync status |
| GET | `/api/sync/history` | Yes | Get sync history |
| DELETE | `/api/sync/clear` | Yes | Clear sync history |

### Social Sharing

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/share/create` | Yes | Create shareable link |
| GET | `/api/share/:shareId` | No | Get share info (public) |
| GET | `/api/share/:shareId/image` | No | Serve shared image file |
| GET | `/api/share/list` | Yes | List user's shared images |
| DELETE | `/api/share/:shareId` | Yes | Delete a share |
| GET | `/share/:shareId` | No | Public share page with OG meta |

### Gallery

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/gallery` | Yes | List gallery images (paginated) |
| GET | `/api/gallery/:id` | Yes | Get single gallery image |
| DELETE | `/api/gallery/:id` | Yes | Soft delete gallery image |
| POST | `/api/gallery/:id/favorite` | Yes | Toggle favorite status |
| GET | `/api/gallery/image/:id` | Yes | Serve gallery image file |
| GET | `/api/gallery/export/:id` | Yes | Export image with format conversion (PNG/JPG/WebP) |
| GET | `/api/gallery/stats` | Yes | Get gallery statistics |
| GET | `/api/gallery/debug` | Yes | Debug endpoint for gallery issues |

**Export Query Parameters:**
- `format` - Output format: `png`, `jpg`, or `webp` (default: `png`)
- `quality` - Compression quality: 1-100 (default: 85)
- `width` / `height` - Optional resize dimensions

### Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/orders` | Yes | List user's orders |
| POST | `/api/orders` | Yes | Create new order |
| GET | `/api/orders/:id` | Yes | Get order details |
| POST | `/api/orders/:id/verify-payment` | Yes | Verify Razorpay payment |

### Subscriptions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/subscription/status` | Yes | Get subscription status |
| GET | `/api/subscription/access` | Yes | Check feature access |
| POST | `/api/subscription/create` | Yes | Create new subscription |
| POST | `/api/subscription/verify` | Yes | Verify subscription payment |
| POST | `/api/subscription/cancel` | Yes | Cancel subscription |
| POST | `/api/subscription/pause` | Yes | Pause subscription |
| POST | `/api/subscription/resume` | Yes | Resume paused subscription |

### Schedule

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/schedule` | Yes | List user's scheduled jobs |
| POST | `/api/schedule` | Yes | Create new scheduled job |
| GET | `/api/schedule/:id` | Yes | Get scheduled job details |
| PUT | `/api/schedule/:id` | Yes | Update scheduled job |
| DELETE | `/api/schedule/:id` | Yes | Delete scheduled job |
| POST | `/api/schedule/:id/toggle` | Yes | Toggle job enabled/disabled |

### Webhooks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/razorpay/webhook` | No* | Razorpay payment events |

*Verified via webhook signature

### Suggestions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/suggestions` | No | Get AI-generated prompt suggestions |
| GET | `/api/suggestions/refresh` | No | Force refresh suggestions (bypass cache) |

**Query Parameters:**
- `lang` - Language: `en` or `zh` (default: `en`)

**Features:**
- Uses GPT-4o-mini for fast, cost-effective generation
- 5-minute in-memory cache to reduce API calls
- Falls back to static translations on API error
- Generates 4 creative, diverse image prompts per request

### Health Check

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Basic health check for deployment |
| GET | `/api/health/details` | Yes | Detailed health with volume/file info |

### Speech Transcription

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/speech/transcribe` | Yes | Transcribe audio to text using OpenAI Whisper |

**Request Format:**
- Content-Type: `multipart/form-data`
- Body: `audio` (file), `language` (optional: `en`, `zh`, etc.)

**Response:**
```json
{
  "success": true,
  "text": "Transcribed text here",
  "language": "en"
}
```

**Features:**
- Uses OpenAI Whisper API for accurate multi-language transcription
- Excellent support for Asian languages and accented speech
- Max file size: 10MB, max duration: ~2 minutes recommended
- Supported formats: WebM, MP3, MP4, WAV, OGG, FLAC, M4A
- Rate limited: 10 requests/minute per user

---

## Frontend Components

### Component Hierarchy

```
App
├── AuthGuard
│   ├── LoginPage (fallback)
│   ├── RegisterPage (fallback)
│   │
│   └── Authenticated App
│       ├── Header
│       │   ├── NewChatButton
│       │   ├── Logo & Title
│       │   ├── User Info
│       │   ├── LanguageToggle
│       │   ├── ThemeToggle
│       │   ├── SettingsButton
│       │   └── LogoutButton
│       │
│       ├── Main Content
│       │   ├── WelcomeScreen (when no messages)
│       │   │   ├── Logo
│       │   │   ├── Welcome Text
│       │   │   ├── Refresh Suggestions Button
│       │   │   └── AI-Generated Suggestion Cards
│       │   │
│       │   └── ChatMessages (when messages exist)
│       │       └── ChatMessage (repeated)
│       │           ├── Avatar
│       │           ├── Message Content
│       │           ├── Generated Image
│       │           │   ├── Open Full Size Button
│       │           │   ├── Sync to TRMNL Button
│       │           │   └── ShareButton
│       │           └── Copy Button
│       │
│       ├── Size Selector
│       │   ├── Square (1024x1024)
│       │   ├── Landscape (1792x1024)
│       │   └── Portrait (1024x1792)
│       │
│       ├── Style Selector (dropdown)
│       │   ├── None (default)
│       │   ├── Photorealistic
│       │   ├── Anime
│       │   ├── Watercolor
│       │   ├── Oil Painting
│       │   ├── Pixel Art
│       │   ├── 3D Render
│       │   ├── Sketch
│       │   ├── Pop Art
│       │   ├── Minimalist
│       │   └── Cinematic
│       │
│       └── ChatInput
│           ├── Textarea
│           ├── Attach Button
│           ├── Mic Button (Speech-to-Text)
│           └── Send Button
│
├── GalleryPage
│   ├── Search Bar
│   ├── Favorites Filter
│   ├── Gallery Grid
│   │   └── GalleryCard (repeated)
│   ├── Load More Button
│   └── ImageDetailModal
│       ├── Image View with Navigation
│       ├── Prompt Details
│       ├── Favorite Toggle
│       ├── Export Dropdown (PNG/JPG/WebP)
│       ├── ShareButton (centered popup)
│       └── Delete Button
│
├── SettingsPage
│   ├── Device API Key Input
│   ├── MAC Address Input
│   ├── Save Button
│   └── Webhook URL Display
│
├── PurchasePage
│   ├── Product Info
│   ├── Quantity Selector
│   ├── Shipping Form
│   └── Razorpay Checkout
│
├── SubscriptionPage
│   ├── Plan Info
│   ├── Subscribe Button
│   └── Razorpay Checkout Modal
│
└── OrdersPage
    └── Order List
        └── OrderCard (repeated)
```

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useAuth` | Authentication state, login, register, logout |
| `useImageGeneration` | Handles API calls to generate images |
| `useTheme` | Dark/light mode toggle with localStorage |
| `useLanguage` | EN/ZH language switching with translations |
| `useSpeechToText` | Web Speech API integration |
| `useTrmnlSync` | Sync images to TRMNL |
| `useGallery` | Gallery state management |
| `useOrders` | Order management |
| `useSubscription` | Subscription state and operations |

---

## Backend Services

### Auth Service (`auth-service.ts`)

```typescript
// Password hashing with Argon2id
hashPassword(password: string): Promise<string>
verifyPassword(password: string, hash: string): Promise<boolean>

// JWT token management
generateToken(user: User): string
verifyToken(token: string): JWTPayload | null
extractToken(authHeader: string): string | null

// User operations
registerUser(email, password, name?): Promise<{user, token} | {error}>
loginUser(email, password): Promise<{user, token} | {error}>
getUserById(id: number): AuthUser | null
```

### Auth Middleware (`auth.ts`)

```typescript
// Wrapper for protected routes
withAuth(handler: (req, user) => Promise<Response>): RequestHandler

// Token verification
authenticateRequest(req: Request): Promise<{user} | {error, status}>
```

### OpenAI Service (`openai-service.ts`)

```typescript
generateImage(prompt, options?)     // DALL-E 3 generation
generateImageEdit(image, prompt)    // Edit with mask
generateImageVariation(image)       // Create variations
translateToLanguage(text, language) // Translate revised prompts
```

### TRMNL Service (`trmnl-service.ts`)

```typescript
sendDisplayContent(macAddress, markup)
getCurrentScreen(macAddress)
getDeviceInfo(macAddress)
uploadPluginImage(pluginId, image)
sendToCustomPlugin(uuid, data)
```

### Razorpay Service (`razorpay-service.ts`)

```typescript
createOrder(amount, currency, receipt)
createCustomer(email, name, contact)
createSubscription(customerId, planId)
getSubscription(subscriptionId)
verifyPaymentSignature(orderId, paymentId, signature)
verifyWebhookSignature(body, signature)
```

---

## TRMNL Plugin

### Plugin Configuration (`settings.yml`)

```yaml
strategy: polling
polling_verb: get
polling_url: http://your-server.com/api/trmnl/webhook/{userId}
refresh_interval: 15
name: PromptInk
```

### Liquid Templates

| Template | Dimensions | Use Case |
|----------|------------|----------|
| `full.liquid` | 800x480 | Full screen display |
| `half_horizontal.liquid` | 800x240 | Top/bottom half |
| `half_vertical.liquid` | 400x480 | Left/right half |
| `quadrant.liquid` | 400x240 | Quarter screen |

### Template Variables

```liquid
{% if has_image %}
  {{ image_url }}    <!-- Generated image URL -->
  {{ prompt }}       <!-- Image prompt/description -->
  {{ synced_at }}    <!-- Sync timestamp -->
{% endif %}
```

---

## Environment Variables

### Backend (`.env`)

```env
# Required
PORT=3000
JWT_SECRET=your-secure-random-string
JWT_REFRESH_SECRET=your-refresh-secret
OPENAI_API_KEY=sk-...

# Database
DB_PATH=./data/promptink.db

# Server
BASE_URL=https://promptink-production.up.railway.app
IMAGES_DIR=/app/data/images

# Admin Dashboard
ADMIN_PASSWORD=your-admin-password
ADMIN_JWT_SECRET=your-admin-jwt-secret  # Falls back to JWT_SECRET if not set

# TRMNL (optional for admin operations)
TRMNL_USER_API_KEY=...
TRMNL_CUSTOM_PLUGIN_UUID=...

# Razorpay
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_PLAN_ID=plan_...
```

> **Note:** `TRMNL_DEVICE_API_KEY` and `TRMNL_MAC_ADDRESS` are now per-user settings stored in the database.

---

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/start.sh` | Start all services (backend + TRMNL) |
| `scripts/stop.sh` | Gracefully stop all services |
| `scripts/status.sh` | Check status of all services |
| `scripts/install.sh` | Install all dependencies |
| `scripts/start-backend.sh` | Start backend only |
| `scripts/start-trmnl.sh` | Start TRMNL preview only |

### Usage

```bash
# Install dependencies
./scripts/install.sh

# Start everything
./scripts/start.sh

# Check status
./scripts/status.sh

# Stop everything
./scripts/stop.sh
```

---

## Ports

| Service | Port | URL |
|---------|------|-----|
| Backend + Frontend | 3000 | http://localhost:3000 |
| TRMNL Plugin Preview | 4567 | http://localhost:4567 |

---

## Technology Stack

### Backend
- **Runtime:** Bun
- **Language:** TypeScript
- **Database:** SQLite (bun:sqlite)
- **Auth:** JWT + Argon2id
- **API Style:** REST
- **Payments:** Razorpay
- **Image Processing:** Sharp (format conversion, resizing)

### Frontend
- **Framework:** React 19
- **Styling:** Tailwind CSS + shadcn/ui
- **Build:** Bun (HTML imports with HMR)
- **State:** React hooks

### TRMNL Plugin
- **Templates:** Liquid
- **CLI:** trmnlp (Ruby gem / Docker)

### External APIs
- **Image Generation:** OpenAI DALL-E 3
- **Display:** TRMNL API
- **Payments:** Razorpay

### CI/CD
- **Platform:** GitHub Actions
- **Testing:** K6 performance testing
- **Monitoring:** Grafana integration

---

## Security Considerations

1. **API Keys:** Stored in `.env`, never committed
2. **Passwords:** Hashed with Argon2id before storage
3. **JWT Tokens:** Signed with HS256, 7-day expiry
4. **CORS:** Handled by Bun server (same-origin)
5. **Input Validation:** Prompt sanitization before OpenAI API
6. **Per-User Data:** Users can only access their own images
7. **Webhook Verification:** Razorpay webhooks verified via signature
8. **Rate Limiting:** In-memory rate limiting with per-endpoint configuration

### Rate Limiting Configuration

The application uses in-memory rate limiting (`backend/src/middleware/rate-limit.ts`) with the following limits:

| Endpoint Category | Max Requests | Window | Purpose |
|-------------------|--------------|--------|----------|
| Auth (`/api/auth/*`) | 10 | 15 min | Brute force protection |
| Image Generation (`/api/images/generate`, `/api/images/edit`) | 5 | 1 min | DALL-E API cost control |
| Speech Transcription (`/api/speech/transcribe`) | 10 | 1 min | Whisper API cost control |
| General API (`/api/*`) | 100 | 1 min | DDoS/abuse protection |
| Health Check (`/api/health`) | Unlimited | - | Railway uptime monitoring |

Rate limit responses include headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `Retry-After`: Seconds until retry is allowed

Monitor rate limit stats via the `/api/health/details` endpoint (requires authentication).

---

## Deployment

### Local Development

```bash
./scripts/start.sh
```

### Docker

```bash
docker build -t promptink .
docker run -p 3000:3000 \
  -e JWT_SECRET=your-secret \
  -e OPENAI_API_KEY=sk-... \
  -v promptink-data:/app/data \
  promptink
```

### Railway

1. Connect GitHub repo to Railway
2. Set environment variables:
   - `JWT_SECRET`
   - `OPENAI_API_KEY`
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`
   - `RAZORPAY_PLAN_ID`
3. Add volume at `/app/data` for SQLite and images
4. Deploy

### TRMNL Plugin Deployment

```bash
cd trmnl-plugin
trmnlp login          # First time only
trmnlp push           # Upload to TRMNL server
```

---

## Mobile Responsiveness

The frontend is fully responsive with:

- **Breakpoints:** xs (375px), sm (640px), md (768px), lg (1024px)
- **Touch-friendly:** 44px minimum tap targets
- **Safe areas:** Support for notched devices
- **Adaptive UI:** Buttons/text resize based on screen

---

## Performance Testing

K6 performance tests are available in `k6/`:

- **Smoke tests**: Quick validation (30s, 1 VU)
- **Load tests**: Normal traffic simulation
- **Stress tests**: Beyond normal capacity
- **Authenticated tests**: Tests requiring login

### Running Tests

```bash
# Local
k6 run k6/scripts/load-test.js

# With custom URL
k6 run -e BASE_URL=https://promptink-production.up.railway.app k6/scripts/load-test.js
```

### GitHub Actions

- Smoke tests run on push to main
- Load tests run daily at 6 AM UTC
- All tests can be triggered manually with "all" option

---

## Completed Features

- [x] AI image generation with DALL-E 3
- [x] Voice-to-text input with OpenAI Whisper (multi-language, accent-friendly)
- [x] JWT authentication
- [x] User registration/login
- [x] SQLite database persistence
- [x] Per-user TRMNL device settings
- [x] Per-user webhook URLs
- [x] Dark/light theme
- [x] Bilingual support (EN/ZH)
- [x] Mobile responsive design
- [x] Docker deployment
- [x] Railway deployment config
- [x] E-commerce with Razorpay
- [x] Subscription management
- [x] Social sharing with OG tags
- [x] Image gallery/history
- [x] K6 performance testing
- [x] CI/CD with GitHub Actions
- [x] AI-generated prompt suggestions
- [x] Multiple image sizes selection
- [x] Image export with format conversion (PNG/JPG/WebP)
- [x] Image style presets
- [x] Scheduled image generation
- [x] Batch image generation
- [x] Admin dashboard with data export/import
- [x] URL migration for server transfers
- [x] Infographic generation from GitHub repos (Repomix integration)

## Future Enhancements

### Quick Wins
- [ ] **Image templates** - Pre-defined prompt templates users can customize (e.g., "Profile picture", "Product photo", "Book cover")
- [ ] **Prompt history autocomplete** - Suggest previously used prompts as user types
- [ ] **Keyboard shortcuts** - Quick actions (Ctrl+Enter to generate, Ctrl+S to sync, etc.)
- [ ] **Image comparison view** - Side-by-side comparison of original vs edited images

### User Experience
- [ ] **Collections/folders** - Organize gallery images into custom collections
- [ ] **Bulk operations** - Select multiple gallery images for batch delete, export, or share
- [ ] **Image tagging** - Add custom tags to images for better organization and search
- [ ] **Generation history timeline** - Visual timeline view of all generated images
- [ ] **Undo/redo for edits** - Track edit history and allow reverting changes

### Advanced Features
- [ ] **Prompt enhancement AI** - Use GPT to improve user prompts before generation
- [ ] **Image upscaling** - AI-powered upscaling for higher resolution exports
- [ ] **Background removal** - Automatic background removal tool
- [ ] **Inpainting improvements** - Better mask drawing tools with brush sizes
- [ ] **Image-to-prompt** - Reverse engineer prompts from uploaded images using vision AI

### Collaboration & Social
- [ ] **Public gallery** - Optional public profile showcasing user's best work
- [ ] **Community prompts** - Share and discover prompts from other users
- [ ] **Prompt remix** - Fork and modify shared prompts from community

### Integrations
- [ ] **Zapier/Make integration** - Automate workflows with external tools
- [ ] **Slack/Discord bot** - Generate images directly from chat platforms
- [ ] **Browser extension** - Quick image generation from any webpage
- [ ] **Mobile app** - Native iOS/Android app for on-the-go generation

### Analytics & Insights
- [ ] **Usage dashboard** - Visualize generation stats, popular prompts, peak times
- [ ] **Cost tracking** - Track API usage and estimated costs per user
- [ ] **A/B prompt testing** - Compare different prompts for the same concept

### Enterprise
- [ ] **Team workspaces** - Shared galleries and settings for teams
- [ ] **Role-based access** - Admin, editor, viewer roles
- [ ] **API access** - REST API for programmatic image generation
- [ ] **White-label option** - Custom branding for enterprise customers
