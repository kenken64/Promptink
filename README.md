# PromptInk

AI-powered image generation app with TRMNL e-ink display sync. Generate stunning images using OpenAI's DALL-E 3 and display them on your TRMNL device.

[![YouTube](https://img.shields.io/badge/YouTube-@promptinkAI-red?logo=youtube)](https://www.youtube.com/@promptinkAI-h4o)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Bun](https://img.shields.io/badge/Bun-1.0+-black.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)

## Features

- **AI Image Generation** - Create images using OpenAI DALL-E 3 with natural language prompts
- **Voice Input** - Speak your prompts using Web Speech API (supports English & Chinese)
- **TRMNL Sync** - Push generated images to TRMNL e-ink displays
- **User Authentication** - Secure JWT-based authentication with email/password
- **Multi-User Support** - Each user has their own TRMNL webhook and device settings
- **Dark/Light Theme** - Toggle between themes with persistent preference
- **Bilingual UI** - Full English and Chinese language support
- **Mobile Responsive** - Optimized for all screen sizes

## Screenshots

| Chat Interface | Settings Page |
|---------------|---------------|
| Generate images with text or voice | Configure your TRMNL device |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- [OpenAI API Key](https://platform.openai.com/api-keys)
- [TRMNL Device](https://usetrmnl.com/) (optional, for e-ink display sync)

### Installation

```bash
# Clone the repository
git clone https://github.com/kenken64/Promptink.git
cd Promptink

# Install dependencies
./scripts/install.sh

# Configure environment
cp .env.example backend/.env
# Edit backend/.env with your API keys
```

### Configuration

Edit `backend/.env`:

```env
# Required
OPENAI_API_KEY=sk-your-openai-api-key
JWT_SECRET=your-secure-random-string

# Optional (for TRMNL admin operations)
TRMNL_USER_API_KEY=your-trmnl-user-api-key
TRMNL_CUSTOM_PLUGIN_UUID=your-plugin-uuid
```

> **Note:** TRMNL device settings (Device API Key, MAC Address) are now configured per-user in the Settings page.

### Running

```bash
# Start all services
./scripts/start.sh

# Check status
./scripts/status.sh

# Stop all services
./scripts/stop.sh
```

**Services:**
- Main App: http://localhost:3000
- TRMNL Plugin Preview: http://localhost:4567

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PromptInk                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │   Frontend   │◄──►│   Backend    │◄──►│  OpenAI DALL-E   │   │
│  │   (React)    │    │    (Bun)     │    │                  │   │
│  └──────────────┘    └──────┬───────┘    └──────────────────┘   │
│                             │                                    │
│                      ┌──────┴───────┐                           │
│                      │   SQLite DB  │                           │
│                      │  - Users     │                           │
│                      │  - Images    │                           │
│                      │  - Settings  │                           │
│                      └──────┬───────┘                           │
│                             │                                    │
│              /api/trmnl/webhook/:userId                         │
│                             │                                    │
│                      ┌──────┴───────┐                           │
│                      │    TRMNL     │                           │
│                      │   Device     │                           │
│                      └──────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
PromptInk/
├── backend/                 # Bun API server
│   ├── src/
│   │   ├── config/         # Environment configuration
│   │   ├── db/             # SQLite database & queries
│   │   ├── middleware/     # Auth middleware
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utilities
│   └── package.json
│
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   └── lib/            # Utilities
│   └── package.json
│
├── trmnl-plugin/           # TRMNL plugin
│   └── src/                # Liquid templates
│
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md     # Detailed architecture docs
│   ├── CHANGELOG.md        # Version history
│   └── *.md                # Feature documentation
│
├── scripts/                # Management scripts
├── Dockerfile              # Docker deployment
└── railway.toml            # Railway deployment config
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout user |

### Image Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/images/generate` | Generate image from prompt |

### TRMNL Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync/trmnl` | Sync image to TRMNL (auth required) |
| GET | `/api/trmnl/webhook/:userId` | Webhook for TRMNL polling |
| GET | `/api/sync/status` | Get sync status |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get user settings |
| PUT | `/api/settings` | Update user settings |

## TRMNL Integration

### Setup

1. Register/Login to PromptInk
2. Go to Settings (gear icon)
3. Enter your TRMNL Device API Key and MAC Address
4. Copy your webhook URL: `https://your-domain/api/trmnl/webhook/{userId}`
5. Configure your TRMNL plugin to poll this URL

### Plugin Deployment

```bash
cd trmnl-plugin
trmnlp login          # First time only
trmnlp push           # Upload to TRMNL server
```

## Deployment

### Railway

1. Connect your GitHub repo to Railway
2. Set environment variables in Railway dashboard:
   - `JWT_SECRET`
   - `OPENAI_API_KEY`
   - `TRMNL_USER_API_KEY` (optional)
3. Add a volume mounted at `/app/data` for SQLite persistence
4. Deploy

### Docker

```bash
docker build -t promptink .
docker run -p 3000:3000 \
  -e JWT_SECRET=your-secret \
  -e OPENAI_API_KEY=sk-... \
  -v promptink-data:/app/data \
  promptink
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Backend | Bun.serve + SQLite |
| Frontend | React 19 + Tailwind CSS + shadcn/ui |
| Auth | JWT + Argon2id |
| Database | SQLite (bun:sqlite) |
| AI | OpenAI DALL-E 3 |
| E-ink Display | TRMNL |

## Development

### Prerequisites

- Bun v1.0+
- Node.js (for some dev tools)

### Commands

```bash
# Start development servers
./scripts/start.sh

# View logs
tail -f logs/backend.log

# Stop servers
./scripts/stop.sh
```

### Frontend Development

The frontend is bundled by Bun's built-in HTML import feature. Changes hot-reload automatically.

### Adding API Routes

1. Create route file in `backend/src/routes/`
2. Export routes object
3. Import and spread in `backend/src/routes/index.ts`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [OpenAI](https://openai.com/) for DALL-E 3
- [TRMNL](https://usetrmnl.com/) for e-ink display platform
- [shadcn/ui](https://ui.shadcn.com/) for UI components
- [Bun](https://bun.sh/) for the runtime

---

Made with Claude Code
