# PromptInk Architecture

## Overview

PromptInk is a full-stack application that generates AI images using OpenAI's DALL-E 3 and syncs them to TRMNL e-ink displays. The application consists of three main components:

1. **Backend** - Bun API server serving both API endpoints and frontend
2. **Frontend** - React-based chat interface with voice input support
3. **peekachoo-trmnl** - TRMNL plugin for displaying synced images on e-ink devices

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
│         │                       │ /api/trmnl/webhook                        │
│         │                       ▼                                           │
│         │              ┌──────────────────┐      ┌───────────────────────┐  │
│         │              │                  │      │                       │  │
│         └─────────────►│   Image Store    │◄─────│   TRMNL Device        │  │
│          Sync Image    │   (In-Memory)    │ Poll │   (E-ink Display)     │  │
│                        │                  │      │                       │  │
│                        └──────────────────┘      └───────────────────────┘  │
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
│   │   ├── routes/            # API route handlers
│   │   │   ├── index.ts       # Route aggregation
│   │   │   ├── display.ts     # Display endpoints
│   │   │   ├── plugins.ts     # Plugin management
│   │   │   ├── device.ts      # Device info
│   │   │   ├── images.ts      # Image generation
│   │   │   └── sync.ts        # TRMNL sync & webhook
│   │   ├── services/          # Business logic
│   │   │   ├── index.ts
│   │   │   ├── trmnl-service.ts
│   │   │   ├── openai-service.ts
│   │   │   └── image-store.ts # In-memory image storage
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
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   └── LanguageToggle.tsx
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── index.ts
│   │   │   ├── useImageGeneration.ts
│   │   │   ├── useTheme.ts
│   │   │   ├── useSpeechToText.ts
│   │   │   ├── useLanguage.ts
│   │   │   └── useTrmnlSync.ts
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── index.html
│   └── package.json
│
├── peekachoo-trmnl/           # TRMNL plugin
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
├── scripts/                   # Management scripts
│   ├── start.sh              # Start all services
│   ├── stop.sh               # Stop all services
│   ├── start-backend.sh
│   ├── stop-backend.sh
│   ├── start-trmnl.sh
│   ├── stop-trmnl.sh
│   └── status.sh
│
├── logs/                      # Application logs
│   ├── backend.log
│   └── trmnl.log
│
├── ARCHITECTURE.md            # This file
└── claude.md                  # Claude Code rules
```

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
     │              Voice Input (Web Speech API)                     │
     └───────────────────────────────────────────────────────────────┘
```

**Steps:**
1. User enters prompt (text or voice)
2. Frontend sends POST to `/api/images/generate`
3. Backend calls OpenAI DALL-E 3 API
4. OpenAI returns image URL and revised prompt
5. Frontend displays the generated image

### TRMNL Sync Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │    │ Frontend │    │ Backend  │    │  TRMNL   │    │  E-ink   │
│  Clicks  │───►│  Sync    │───►│  Store   │◄───│  Server  │───►│ Display  │
│  Sync    │    │  Button  │    │  Image   │    │  (Poll)  │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

**Steps:**
1. User clicks "Sync to TRMNL" button
2. Frontend sends POST to `/api/sync/trmnl` with image URL
3. Backend stores image URL in memory
4. TRMNL server polls `/api/trmnl/webhook`
5. Backend returns stored image data
6. TRMNL renders image on e-ink display

---

## API Endpoints

### Image Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/images/generate` | Generate image from prompt |
| POST | `/api/images/edit` | Edit existing image |
| POST | `/api/images/variation` | Create image variation |

**Request Body (generate):**
```json
{
  "prompt": "A serene Japanese garden at sunset",
  "size": "1024x1024",
  "quality": "standard",
  "style": "vivid"
}
```

**Response:**
```json
{
  "data": [{
    "url": "https://oaidalleapi...",
    "revised_prompt": "A tranquil Japanese garden..."
  }]
}
```

### TRMNL Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync/trmnl` | Store image for TRMNL sync |
| GET | `/api/trmnl/webhook` | Webhook for TRMNL polling |
| GET | `/api/sync/status` | Check sync status |

**Sync Request:**
```json
{
  "imageUrl": "https://oaidalleapi...",
  "prompt": "A serene Japanese garden..."
}
```

**Webhook Response:**
```json
{
  "has_image": true,
  "image_url": "https://oaidalleapi...",
  "prompt": "A serene Japanese garden...",
  "synced_at": "2024-01-10T12:00:00.000Z"
}
```

---

## Frontend Components

### Component Hierarchy

```
App
├── Header
│   ├── NewChatButton
│   ├── Logo & Title
│   ├── LanguageToggle
│   └── ThemeToggle
│
├── Main Content
│   ├── WelcomeScreen (when no messages)
│   │   ├── Logo
│   │   ├── Welcome Text
│   │   └── Suggestion Cards
│   │
│   └── ChatMessages (when messages exist)
│       └── ChatMessage (repeated)
│           ├── Avatar
│           ├── Message Content
│           ├── Generated Image
│           │   ├── Download Button
│           │   └── Sync Button
│           └── Copy Button
│
└── ChatInput
    ├── Image Icon
    ├── Textarea
    ├── Mic Button (Speech-to-Text)
    └── Send Button
```

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useImageGeneration` | Handles API calls to generate images |
| `useTheme` | Dark/light mode toggle with localStorage |
| `useLanguage` | EN/ZH language switching with translations |
| `useSpeechToText` | Web Speech API integration |
| `useTrmnlSync` | Sync images to TRMNL |

---

## Backend Services

### OpenAI Service (`openai-service.ts`)

```typescript
// Available functions
generateImage(prompt, options?)     // DALL-E 3 generation
generateImageEdit(image, prompt)    // Edit with mask
generateImageVariation(image)       // Create variations
```

### Image Store (`image-store.ts`)

```typescript
// In-memory storage for TRMNL sync
setLatestImage(imageUrl, prompt?)   // Store image
getLatestImage()                    // Retrieve for polling
clearLatestImage()                  // Clear stored image
```

### TRMNL Service (`trmnl-service.ts`)

```typescript
// TRMNL API integration
sendDisplayContent(macAddress, markup)
getCurrentScreen(macAddress)
getDeviceInfo(macAddress)
uploadPluginImage(pluginId, image)
sendToCustomPlugin(uuid, data)
```

---

## TRMNL Plugin

### Plugin Configuration (`settings.yml`)

```yaml
strategy: polling
polling_verb: get
polling_url: http://your-server.com/api/trmnl/webhook
refresh_interval: 15
name: PromptInk
```

### Liquid Templates

The plugin supports multiple display layouts:

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
# OpenAI
OPENAI_API_KEY=sk-...

# TRMNL
TRMNL_DEVICE_API_KEY=...
TRMNL_USER_API_KEY=...
TRMNL_MAC_ADDRESS=...
TRMNL_CUSTOM_PLUGIN_UUID=...

# Server
PORT=3000
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/start.sh` | Start all services (backend + TRMNL) |
| `scripts/stop.sh` | Gracefully stop all services |
| `scripts/status.sh` | Check status of all services |
| `scripts/start-backend.sh` | Start backend only |
| `scripts/start-trmnl.sh` | Start TRMNL preview only |

### Usage

```bash
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
- **API Style:** REST

### Frontend
- **Framework:** React 18
- **Styling:** Tailwind CSS + shadcn/ui
- **Build:** Bun (HTML imports)

### TRMNL Plugin
- **Templates:** Liquid
- **CLI:** trmnlp (Ruby gem / Docker)

### External APIs
- **Image Generation:** OpenAI DALL-E 3
- **Display:** TRMNL API

---

## Security Considerations

1. **API Keys:** Stored in `.env`, never committed
2. **CORS:** Handled by Bun server
3. **Input Validation:** Prompt sanitization before OpenAI API
4. **Rate Limiting:** Recommended for production

---

## Deployment

### Local Development

```bash
./scripts/start.sh
```

### Production

1. Deploy backend to cloud provider (Railway, Fly.io, etc.)
2. Set environment variables
3. Update TRMNL plugin `polling_url` to public URL
4. Push plugin: `trmnlp push`

### TRMNL Plugin Deployment

```bash
cd peekachoo-trmnl
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

## Future Enhancements

- [ ] Persistent image storage (database)
- [ ] User authentication
- [ ] Image history/gallery
- [ ] Multiple TRMNL device support
- [ ] Scheduled image generation
- [ ] Image style presets
