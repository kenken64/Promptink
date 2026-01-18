# PromptInk Project Rules

This is a monorepo with three main components:

- `backend/` - Bun API server
- `frontend/` - React application
- `trmnl-plugin/` - TRMNL plugin

---

## Backend (Bun API Server)

Default to using Bun instead of Node.js.

### Project Structure

```
backend/
├── src/
│   ├── routes/         # Route handlers
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   ├── config/         # Configuration
│   └── index.ts        # Main server entry point
├── package.json
├── tsconfig.json
├── bunfig.toml
└── .env
```

### Commands

```sh
cd backend
bun run dev      # Development with hot reload
bun run start    # Production
bun test         # Run tests
bun install      # Install dependencies
```

### APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Use `Bun.$\`cmd\`` instead of execa
- Bun automatically loads .env, so don't use dotenv

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

The frontend is a React application served via Bun's HTML imports.

### Project Structure

```
frontend/
├── index.html              # Entry point
├── src/
│   ├── assets/             # Images, fonts, global CSS
│   │   └── styles.css
│   ├── components/         # Reusable UI components (buttons, modals, etc.)
│   │   └── index.ts
│   ├── hooks/              # Custom hooks
│   │   └── index.ts
│   ├── utils/              # Helper functions (formatters, etc.)
│   │   └── index.ts
│   ├── App.tsx             # Root component
│   └── index.tsx           # React entry point
```

### Guidelines

- Use React with TypeScript (`.tsx` files)
- CSS can be imported directly in components
- Don't use Vite, Webpack, or other bundlers - Bun handles bundling
- Use functional components with hooks
- Export components/hooks/utils from their respective `index.ts` files

### Adding Components

1. Create component file in `src/components/` (e.g., `Button.tsx`)
2. Export from `src/components/index.ts`

```tsx
// src/components/Button.tsx
interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
}

export function Button({ children, onClick }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>
}
```

### Adding Hooks

1. Create hook file in `src/hooks/` (e.g., `useApi.ts`)
2. Export from `src/hooks/index.ts`

### Adding Utils

1. Create util file in `src/utils/` (e.g., `formatters.ts`)
2. Export from `src/utils/index.ts`

---

## trmnl-plugin (TRMNL Plugin)

This is a TRMNL e-ink display plugin using the trmnlp framework.

### Structure

- `src/` - Liquid templates for different display sizes
  - `full.liquid` - Full screen layout
  - `half_horizontal.liquid` - Half horizontal layout
  - `half_vertical.liquid` - Half vertical layout
  - `quadrant.liquid` - Quarter screen layout
  - `shared.liquid` - Shared partials
  - `settings.yml` - Plugin settings schema
- `.trmnlp.yml` - Plugin configuration
- `bin/trmnlp` - CLI tool

### Template Guidelines

- Use Liquid templating syntax
- Variables are passed via `merge_variables` from the backend API
- Design for e-ink displays (black, white, limited grayscale)
- Keep layouts simple and readable at a distance

### Development

The plugin watches for changes in `src/` and `.trmnlp.yml` by default.

---

## Environment Variables

Backend requires these environment variables (in `backend/.env`):

- `TRMNL_DEVICE_API_KEY` - Device access token
- `TRMNL_MAC_ADDRESS` - Device MAC address
- `TRMNL_USER_API_KEY` - (Optional) User API key for plugin management
- `TRMNL_CUSTOM_PLUGIN_UUID` - (Optional) Custom plugin webhook UUID
- `OPENAI_API_KEY` - OpenAI API key for image generation

---

## Project Conventions

- TypeScript for all backend and frontend code
- No semicolons (follow existing code style)
- Use async/await over promises
- Handle errors with try/catch blocks
- Log with the backend's `log()` utility function

---

## Documentation Rules

- **DO NOT** create markdown (`.md`) files in the project root or subdirectories
- Exceptions: `README.md` and `claude.md` are allowed in the root
- All other documentation must be created in the `docs/` folder
- Update existing documentation rather than creating new files when possible
