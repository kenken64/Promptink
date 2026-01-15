# PromptInk Architecture

## Overview

PromptInk is an AI image generation application that integrates with TRMNL e-ink displays. Users can generate images using DALL-E and sync them to their TRMNL device. The application includes a complete e-commerce system for device purchases with Razorpay payment integration and subscription management.

## System Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│   OpenAI API    │
│  (React + Bun)  │     │   (Bun Server)  │     │  (DALL-E 3/2)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
           ┌──────────────┐ ┌──────────┐ ┌──────────────┐
           │  SQLite DB   │ │ Razorpay │ │  TRMNL API   │
           │ (Persistent) │ │   API    │ │  (Webhook)   │
           └──────────────┘ └──────────┘ └──────────────┘
```

## Project Structure

```
promptink/
├── backend/                 # Bun-based API server
│   └── src/
│       ├── config/          # Environment configuration
│       ├── db/              # SQLite database & queries
│       ├── middleware/      # Auth middleware (JWT)
│       ├── routes/          # API route handlers
│       │   ├── auth.ts      # Login/register
│       │   ├── images.ts    # DALL-E generation
│       │   ├── sync.ts      # TRMNL sync
│       │   ├── share.ts     # Social sharing
│       │   ├── gallery.ts   # Image gallery
│       │   ├── orders.ts    # Order management
│       │   ├── subscription.ts  # Subscription management
│       │   ├── razorpay-webhook.ts  # Payment webhooks
│       │   ├── settings.ts  # User settings
│       │   └── device.ts    # Device management
│       ├── services/        # Business logic
│       │   ├── openai-service.ts
│       │   ├── trmnl-service.ts
│       │   ├── order-service.ts
│       │   ├── subscription-service.ts
│       │   ├── razorpay-service.ts
│       │   └── image-store.ts
│       └── utils/           # Logging & helpers
├── frontend/                # React SPA
│   └── src/
│       ├── components/      # UI components
│       │   ├── ShareButton.tsx  # Social sharing button
│       │   ├── GalleryCard.tsx  # Gallery image card
│       │   ├── ImageDetailModal.tsx  # Full image modal
│       │   └── ...
│       ├── hooks/           # Custom React hooks
│       │   ├── useAuth.ts
│       │   ├── useOrders.ts
│       │   ├── useSubscription.ts
│       │   ├── useGallery.ts    # Gallery state management
│       │   └── useTrmnlSync.ts
│       └── pages/           # Route pages
│           ├── LoginPage.tsx
│           ├── PurchasePage.tsx
│           ├── SubscriptionPage.tsx
│           ├── OrdersPage.tsx
│           └── GalleryPage.tsx  # Image gallery page
├── trmnl-plugin/            # TRMNL display templates
│   └── src/
│       ├── full.liquid      # Full-screen layout
│       ├── half_*.liquid    # Half-screen layouts
│       └── quadrant.liquid  # Quarter layout
└── scripts/                 # Dev/deployment scripts
```

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

**Trade-offs**:
- **Storage**: Binary images are stored directly (no base64 overhead)
- **One image per user**: Simplifies storage, always shows latest synced image
- **Persistent volume required**: Railway volume must be mounted at `/app/data`
- **Benefit**: Images never expire, efficient storage, simple URL structure

**Code location**: [backend/src/routes/sync.ts](backend/src/routes/sync.ts)

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

**Environment Variables Required**:
- `BASE_URL` - Production URL (e.g., `https://promptink-production.up.railway.app`)
- `IMAGES_DIR` - Image storage directory (default: `/app/data/images`)

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

**Code location**: [frontend/src/components/ChatInput.tsx](frontend/src/components/ChatInput.tsx)

### 4. Multi-language Support

**Problem**: DALL-E 3 always returns `revised_prompt` in English, even when the input was in Chinese.

**Solution**: When the user's language is Chinese, the backend translates the `revised_prompt` back to Chinese using GPT-4o-mini.

**Code location**: [backend/src/routes/images.ts](backend/src/routes/images.ts), [backend/src/services/openai-service.ts](backend/src/services/openai-service.ts)

### 5. Payment & E-commerce System

**Solution**: Razorpay integration for device purchases and subscriptions.

**Implementation**:
- **Orders**: Users can purchase TRMNL devices ($120/unit)
- **Subscriptions**: Monthly subscription plan managed via Razorpay
- **Webhooks**: Razorpay webhook endpoint for payment/subscription events
- **Idempotency**: Webhook events are deduplicated using event IDs

**Code locations**:
- [backend/src/services/razorpay-service.ts](backend/src/services/razorpay-service.ts) - Razorpay API integration
- [backend/src/services/order-service.ts](backend/src/services/order-service.ts) - Order management
- [backend/src/services/subscription-service.ts](backend/src/services/subscription-service.ts) - Subscription logic
- [backend/src/routes/razorpay-webhook.ts](backend/src/routes/razorpay-webhook.ts) - Webhook handler

**Environment Variables Required**:
- `RAZORPAY_KEY_ID` - Razorpay API key ID
- `RAZORPAY_KEY_SECRET` - Razorpay API key secret
- `RAZORPAY_WEBHOOK_SECRET` - Webhook signature verification secret
- `RAZORPAY_PLAN_ID` - Subscription plan ID

### 6. Social Sharing

**Solution**: Permanent shareable links with social media integration and Open Graph meta tags.

**Implementation**:
- Images are stored with unique share IDs in `/app/data/images/shared/`
- Share page includes Open Graph and Twitter Card meta tags for rich previews
- Pre-generated social share links for Twitter, Facebook, LinkedIn, Telegram, Pinterest, WhatsApp
- View count tracking for shared images
- Optional expiration dates for shares

**Code locations**:
- [backend/src/routes/share.ts](backend/src/routes/share.ts) - Share API endpoints and share page
- [frontend/src/components/ShareButton.tsx](frontend/src/components/ShareButton.tsx) - Share UI component

**Features**:
- One-click sharing to Twitter, Facebook, LinkedIn, Telegram
- Copy link to clipboard
- Rich social media previews with image and prompt
- Public share page with view counter
- Landing page with CTA to create own images

### 7. Image Gallery / History

**Problem**: Users want to view and manage their previously generated images.

**Solution**: Auto-save all generated images to a gallery with full browsing, search, and management capabilities.

**Implementation**:
- Images are automatically saved to the gallery when generated (for authenticated users)
- Stored in `/app/data/images/gallery/user_{userId}/{imageId}.png`
- Gallery supports pagination, search by prompt, and favorites filtering
- Images can be favorited, deleted (soft delete), and shared
- Full metadata preserved: prompt, revised prompt, model, size, style

**Code locations**:
- [backend/src/routes/gallery.ts](backend/src/routes/gallery.ts) - Gallery API endpoints
- [backend/src/routes/images.ts](backend/src/routes/images.ts) - Auto-save integration
- [frontend/src/pages/GalleryPage.tsx](frontend/src/pages/GalleryPage.tsx) - Gallery UI
- [frontend/src/hooks/useGallery.ts](frontend/src/hooks/useGallery.ts) - Gallery state management
- [frontend/src/components/GalleryCard.tsx](frontend/src/components/GalleryCard.tsx) - Image card component
- [frontend/src/components/ImageDetailModal.tsx](frontend/src/components/ImageDetailModal.tsx) - Full image modal

**Features**:
- Responsive grid layout (2-5 columns based on screen size)
- Infinite scroll with "Load More" pagination
- Search by prompt text
- Filter by favorites
- Keyboard navigation in detail modal (arrows, escape)
- Toggle favorite status
- Download images
- Share images (integrates with social sharing)
- Soft delete with confirmation
- Image metadata display (prompt, model, size, date)
- Visual badges for favorited and edited images

## Data Flow

### Image Generation Flow

1. User enters prompt in frontend
2. Frontend sends prompt to `/api/images/generate`
3. Backend calls DALL-E 3 API
4. If Chinese language, backend translates revised_prompt
5. Backend returns image URL and revised prompt
6. Frontend displays generated image

### Image Sync Flow

1. User clicks "Sync to TRMNL" button
2. Frontend sends image URL to `/api/sync/trmnl`
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

### Gallery Browse Flow

1. User navigates to Gallery page
2. Frontend fetches images from `/api/gallery` with pagination
3. Frontend fetches stats from `/api/gallery/stats`
4. User can:
   - Search by prompt text
   - Filter by favorites only
   - Click image to open detail modal
   - Navigate with keyboard arrows
   - Toggle favorite status
   - Download image
   - Share image (creates share link)
   - Delete image (soft delete)

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

1. First purchase triggers subscription creation
2. Razorpay handles recurring billing
3. Webhook events update subscription status:
   - `subscription.activated` - Subscription starts
   - `subscription.charged` - Monthly renewal
   - `subscription.cancelled` - User cancelled
   - `subscription.paused` - Payment paused
   - `subscription.pending` / `payment.failed` - Past due

## Database Schema

### users table

| Column                          | Type     | Description                              |
|---------------------------------|----------|------------------------------------------|
| id                              | INTEGER  | Primary key                              |
| email                           | TEXT     | Unique email address                     |
| password_hash                   | TEXT     | Bcrypt hashed password                   |
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

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login and get tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Invalidate tokens

### Images
- `POST /api/images/generate` - Generate image with DALL-E
- `POST /api/images/edit` - Edit existing image
- `GET /api/images/synced/:userId` - Serve synced image file

### TRMNL Sync
- `POST /api/sync/trmnl` - Sync image to TRMNL device
- `GET /api/trmnl/webhook/:userId` - Polling endpoint for TRMNL

### Social Sharing
- `POST /api/share/create` - Create shareable link for an image
- `GET /api/share/:shareId` - Get share info (public)
- `GET /api/share/:shareId/image` - Serve shared image file (public)
- `GET /api/share/list` - List user's shared images
- `DELETE /api/share/:shareId` - Delete a share
- `GET /share/:shareId` - Public share page with Open Graph meta tags

### Gallery
- `GET /api/gallery` - List user's gallery images (paginated, searchable)
- `GET /api/gallery/:id` - Get single gallery image
- `DELETE /api/gallery/:id` - Soft delete gallery image
- `POST /api/gallery/:id/favorite` - Toggle favorite status
- `GET /api/gallery/image/:id` - Serve gallery image file
- `GET /api/gallery/stats` - Get gallery statistics (total, favorites)

### Orders
- `GET /api/orders` - List user's orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `POST /api/orders/:id/verify-payment` - Verify Razorpay payment

### Subscriptions
- `GET /api/subscription/status` - Get subscription status
- `GET /api/subscription/access` - Check feature access
- `POST /api/subscription/create` - Create new subscription
- `POST /api/subscription/cancel` - Cancel subscription
- `POST /api/subscription/pause` - Pause subscription
- `POST /api/subscription/resume` - Resume paused subscription

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings

### Webhooks
- `POST /api/razorpay/webhook` - Razorpay payment/subscription events

## Deployment

**Platform**: Railway

**Configuration** (railway.toml):
- Build command: `bun install`
- Start command: `bun run start`
- Health check: `/api/health`

**Persistent Storage**:
- Volume mounted at `/app/data`
- Contains: SQLite database, synced images

**Environment Variables**:
```
# Server
BASE_URL=https://promptink-production.up.railway.app
PORT=3000

# Database
DB_PATH=/app/data/promptink.db
IMAGES_DIR=/app/data/images

# Auth
JWT_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>

# OpenAI
OPENAI_API_KEY=<key>

# TRMNL
TRMNL_CUSTOM_PLUGIN_UUID=<uuid>
TRMNL_API_KEY=<key>

# Razorpay
RAZORPAY_KEY_ID=<key_id>
RAZORPAY_KEY_SECRET=<secret>
RAZORPAY_WEBHOOK_SECRET=<webhook_secret>
RAZORPAY_PLAN_ID=<plan_id>
```
