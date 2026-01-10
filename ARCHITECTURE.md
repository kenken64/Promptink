# PromptInk Architecture

## Overview

PromptInk is a full-stack application that generates AI images using OpenAI's DALL-E 3 and syncs them to TRMNL e-ink displays. The application features JWT authentication, per-user settings, and SQLite persistence.

**Components:**
1. **Backend** - Bun API server with SQLite database
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
│         │              ┌────────┴─────────┐                                 │
│         │              │                  │                                 │
│         │              │   SQLite DB      │                                 │
│         │              │   - users        │                                 │
│         │              │   - synced_images│                                 │
│         │              │   - sessions     │                                 │
│         │              │                  │                                 │
│         │              └────────┬─────────┘                                 │
│         │                       │                                           │
│         │              /api/trmnl/webhook/:userId                           │
│         │                       │                                           │
│         │              ┌────────┴─────────┐      ┌───────────────────────┐  │
│         │              │                  │      │                       │  │
│         └─────────────►│   Per-User       │◄─────│   TRMNL Device        │  │
│          Sync Image    │   Image Store    │ Poll │   (E-ink Display)     │  │
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
│   │   ├── db/                # Database layer
│   │   │   └── index.ts       # SQLite setup, tables, queries
│   │   ├── middleware/        # Express-style middleware
│   │   │   └── auth.ts        # JWT authentication middleware
│   │   ├── routes/            # API route handlers
│   │   │   ├── index.ts       # Route aggregation
│   │   │   ├── auth.ts        # Authentication endpoints
│   │   │   ├── settings.ts    # User settings endpoints
│   │   │   ├── display.ts     # Display endpoints
│   │   │   ├── plugins.ts     # Plugin management
│   │   │   ├── device.ts      # Device info
│   │   │   ├── images.ts      # Image generation
│   │   │   └── sync.ts        # TRMNL sync & webhook
│   │   ├── services/          # Business logic
│   │   │   ├── index.ts
│   │   │   ├── auth-service.ts    # JWT, password hashing
│   │   │   ├── trmnl-service.ts
│   │   │   ├── openai-service.ts
│   │   │   └── image-store.ts
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
│   │   │   └── LanguageToggle.tsx
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── index.ts
│   │   │   ├── useAuth.ts         # Authentication state
│   │   │   ├── useImageGeneration.ts
│   │   │   ├── useTheme.ts
│   │   │   ├── useSpeechToText.ts
│   │   │   ├── useLanguage.ts
│   │   │   └── useTrmnlSync.ts
│   │   ├── pages/             # Page components
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── SettingsPage.tsx
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
│   ├── install.sh            # Install dependencies
│   ├── start-backend.sh
│   ├── stop-backend.sh
│   ├── start-trmnl.sh
│   ├── stop-trmnl.sh
│   └── status.sh
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

## Database Schema

### SQLite Tables

```sql
-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  trmnl_device_api_key TEXT,      -- Per-user TRMNL settings
  trmnl_mac_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Synced images (per user)
CREATE TABLE synced_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  prompt TEXT,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sessions table (for token invalidation)
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

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
     │              Voice Input (Web Speech API)                     │
     └───────────────────────────────────────────────────────────────┘
```

**Steps:**
1. User enters prompt (text or voice)
2. Frontend sends POST to `/api/images/generate` with JWT token
3. Backend validates token, calls OpenAI DALL-E 3 API
4. OpenAI returns image URL and revised prompt
5. Frontend displays the generated image

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
3. Backend stores image URL in SQLite for user
4. Returns user-specific webhook URL
5. TRMNL server polls `/api/trmnl/webhook/:userId`
6. Backend returns latest synced image for that user
7. TRMNL renders image on e-ink display

---

## API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login user |
| GET | `/api/auth/me` | Yes | Get current user info |
| POST | `/api/auth/logout` | Yes | Logout user |

**Register Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Login Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### User Settings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/settings` | Yes | Get user settings |
| PUT | `/api/settings` | Yes | Update user settings |

**Settings Request/Response:**
```json
{
  "trmnl_device_api_key": "device-api-key",
  "trmnl_mac_address": "58:8C:81:A9:7D:14"
}
```

### Image Generation

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/images/generate` | Yes | Generate image from prompt |

**Request Body:**
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

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/sync/trmnl` | Yes | Store image for TRMNL sync |
| GET | `/api/trmnl/webhook/:userId` | No | Webhook for TRMNL polling |
| GET | `/api/sync/status` | Yes | Check sync status |
| GET | `/api/sync/history` | Yes | Get sync history |
| DELETE | `/api/sync/clear` | Yes | Clear sync history |

**Sync Request:**
```json
{
  "imageUrl": "https://oaidalleapi...",
  "prompt": "A serene Japanese garden..."
}
```

**Sync Response:**
```json
{
  "success": true,
  "message": "Image synced successfully",
  "webhookUrl": "/api/trmnl/webhook/1"
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

### Health Check

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Health check for deployment |

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
│       │   │   └── Suggestion Cards
│       │   │
│       │   └── ChatMessages (when messages exist)
│       │       └── ChatMessage (repeated)
│       │           ├── Avatar
│       │           ├── Message Content
│       │           ├── Generated Image
│       │           │   ├── Open Full Size Button
│       │           │   └── Sync to TRMNL Button
│       │           └── Copy Button
│       │
│       └── ChatInput
│           ├── Textarea
│           ├── Attach Button
│           ├── Mic Button (Speech-to-Text)
│           └── Send Button
│
└── SettingsPage
    ├── Device API Key Input
    ├── MAC Address Input
    ├── Save Button
    └── Webhook URL Display
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
```

### TRMNL Service (`trmnl-service.ts`)

```typescript
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
OPENAI_API_KEY=sk-...

# Database
DB_PATH=./data/promptink.db

# Optional (for admin TRMNL operations)
TRMNL_USER_API_KEY=...
TRMNL_CUSTOM_PLUGIN_UUID=...
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

---

## Security Considerations

1. **API Keys:** Stored in `.env`, never committed
2. **Passwords:** Hashed with Argon2id before storage
3. **JWT Tokens:** Signed with HS256, 7-day expiry
4. **CORS:** Handled by Bun server (same-origin)
5. **Input Validation:** Prompt sanitization before OpenAI API
6. **Per-User Data:** Users can only access their own images
7. **Rate Limiting:** Recommended for production

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
3. Add volume at `/app/data` for SQLite
4. Deploy

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

## Completed Features

- [x] AI image generation with DALL-E 3
- [x] Voice-to-text input (EN/ZH)
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

## Future Enhancements

- [ ] Image history/gallery view
- [ ] Multiple image sizes
- [ ] Image style presets
- [ ] Scheduled image generation
- [ ] Social sharing
- [ ] Export to other formats
