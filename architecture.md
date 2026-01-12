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

**Solution**: Convert DALL-E images to base64 data URLs before storage.

**Implementation**:
1. When a user syncs an image, the backend immediately downloads the image from the DALL-E URL
2. The image is converted to a base64 data URL (`data:image/png;base64,...`)
3. The base64 data URL is stored in the SQLite database instead of the expiring DALL-E URL
4. The same base64 data URL is sent to TRMNL's webhook API
5. Both the TRMNL webhook push and polling endpoint now serve permanent, non-expiring image data

**Trade-offs**:
- **Storage**: Base64 images are ~33% larger than binary. A 1MB image becomes ~1.33MB in base64
- **Database size**: SQLite handles large text fields well, but database size will grow faster
- **Benefit**: Images never expire, ensuring reliable display on TRMNL devices

**Code location**: `backend/src/routes/sync.ts`

```typescript
// Download image and convert to base64 data URL
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl)
  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")
  const contentType = response.headers.get("content-type") || "image/png"
  return `data:${contentType};base64,${base64}`
}
```

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
