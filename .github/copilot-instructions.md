# PromptInk Copilot Instructions

## Project Overview

This is a monorepo with three main components:
- `backend/` - Bun API server
- `frontend/` - React application  
- `trmnl-plugin/` - TRMNL e-ink display plugin

---

## Backend (Bun API Server)

**Always use Bun instead of Node.js.**

### Key APIs

- Use `Bun.serve()` for HTTP server - NOT express
- Use `bun:sqlite` for SQLite - NOT better-sqlite3
- Use `Bun.file` over `node:fs` readFile/writeFile
- Bun auto-loads .env - do NOT use dotenv
- WebSocket is built-in - do NOT use ws

### Adding Routes

1. Create file in `src/routes/` (e.g., `users.ts`)
2. Export routes object with endpoints
3. Import and spread into `src/routes/index.ts`

### Adding Services

1. Create file in `src/services/` (e.g., `user-service.ts`)
2. Export service functions
3. Re-export from `src/services/index.ts`

---

## Frontend (React)

### Guidelines

- Use React with TypeScript (`.tsx` files)
- Use functional components with hooks
- Do NOT use Vite, Webpack, or other bundlers - Bun handles bundling
- Export components/hooks/utils from their respective `index.ts` files

### Adding Components

1. Create component file in `src/components/`
2. Export from `src/components/index.ts`

---

## Code Style

- TypeScript for all code
- **No semicolons** (follow existing code style)
- Use async/await over promises
- Handle errors with try/catch blocks
- Log with the backend's `log()` utility function

---

## Pre-Push Checklist (CRITICAL)

Before ANY push to GitHub, you MUST:

1. **Build the frontend** to catch TypeScript/syntax errors:
   ```sh
   cd frontend
   bun run build
   ```

2. **Check for errors** in modified files using IDE error checker

3. **Verify closing tags** - ensure all JSX elements have matching closing tags

**The Docker build WILL FAIL if there are TypeScript errors.**

---

## Documentation Rules

- **DO NOT** create markdown files in project root or subdirectories
- Exceptions: `README.md` and `claude.md` in root only
- All other docs must go in `docs/` folder
- Update existing documentation rather than creating new files

---

## Environment Variables

Backend requires in `backend/.env`:
- `TRMNL_DEVICE_API_KEY` - Device access token
- `TRMNL_MAC_ADDRESS` - Device MAC address
- `OPENAI_API_KEY` - OpenAI API key for image generation
- `JWT_SECRET` - Secret for JWT tokens
- `RESEND_API_KEY` - Resend API key for emails (optional)
