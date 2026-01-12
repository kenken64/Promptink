# PromptInk Architecture

## Overview

PromptInk is an AI image generation application that integrates with TRMNL e-ink displays. Users can generate images using DALL-E and sync them to their TRMNL device.

## System Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│   OpenAI API    │
│  (React + Bun)  │     │   (Bun Server)  │     │  (DALL-E 3/2)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   SQLite DB     │
                        │  (Persistent)   │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   TRMNL API     │
                        │   (Webhook)     │
                        └─────────────────┘
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

**Environment Variables Required**:
- `BASE_URL` - Production URL (e.g., `https://promptink-production.up.railway.app`)
- `IMAGES_DIR` - Image storage directory (default: `/app/data/images`)

### 2. TRMNL Integration Strategy

**Strategy**: Webhook (push-based) with polling fallback

The backend pushes image data to TRMNL's custom plugin webhook API when syncing. This provides immediate updates to the device. The polling endpoint (`/api/trmnl/webhook/:userId`) serves as a fallback.

**Webhook endpoint**: `POST https://usetrmnl.com/api/custom_plugins/{plugin_uuid}`

### 3. Image Format Handling

**Problem**: DALL-E image edit API only accepts PNG format with specific MIME type.

**Solution**: Frontend converts all images to PNG using HTML Canvas before upload.

**Code location**: `frontend/src/components/ChatInput.tsx`

### 4. Multi-language Support

**Problem**: DALL-E 3 always returns `revised_prompt` in English, even when the input was in Chinese.

**Solution**: When the user's language is Chinese, the backend translates the `revised_prompt` back to Chinese using GPT-4o-mini.

**Code location**: `backend/src/routes/images.ts`, `backend/src/services/openai-service.ts`

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
4. Backend converts to base64 data URL
5. Backend stores base64 in SQLite database
6. Backend pushes base64 to TRMNL webhook API
7. TRMNL device displays the image

## Database Schema

### synced_images table

| Column     | Type     | Description                           |
|------------|----------|---------------------------------------|
| id         | INTEGER  | Primary key                           |
| user_id    | INTEGER  | Foreign key to users table            |
| image_url  | TEXT     | Base64 data URL (not expiring URL)    |
| prompt     | TEXT     | Original prompt                       |
| synced_at  | DATETIME | Timestamp of sync                     |
