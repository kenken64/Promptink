# Backend - Bun API Server

Default to using Bun instead of Node.js.

## Project Structure

```
backend/
├── src/
│   ├── routes/         # Route handlers
│   │   ├── index.ts    # Route aggregation
│   │   ├── display.ts  # Display-related endpoints
│   │   ├── plugins.ts  # Plugin management endpoints
│   │   └── device.ts   # Device info endpoints
│   ├── services/       # Business logic
│   │   ├── index.ts    # Service exports
│   │   └── trmnl-service.ts  # TRMNL API integration
│   ├── utils/          # Utility functions
│   │   ├── index.ts    # Utility exports
│   │   └── logger.ts   # Logging utility
│   ├── config/         # Configuration
│   │   └── index.ts    # Environment config
│   └── index.ts        # Main server entry point
├── package.json
├── tsconfig.json
├── bunfig.toml
└── .env
```

## Commands

- `bun run dev` - Start development server with hot reload
- `bun run start` - Start production server
- `bun test` - Run tests
- `bun install` - Install dependencies

## Bun Commands (General)

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build` instead of `webpack` or `esbuild`
- Bun automatically loads .env, so don't use dotenv

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Use `Bun.$\`cmd\`` instead of execa

## Adding New Routes

1. Create a new file in `src/routes/` (e.g., `src/routes/users.ts`)
2. Export a routes object with your endpoints
3. Import and spread into `src/routes/index.ts`

Example:

```ts
// src/routes/users.ts
import { log } from "../utils"

export const userRoutes = {
  "/api/users": {
    GET: async () => {
      return Response.json({ users: [] })
    },
  },
  "/api/users/:id": {
    GET: async (req: Request & { params: { id: string } }) => {
      return Response.json({ id: req.params.id })
    },
  },
}
```

## Adding New Services

1. Create a new file in `src/services/` (e.g., `src/services/user-service.ts`)
2. Export your service functions
3. Re-export from `src/services/index.ts`

## Testing

Use `bun test` to run tests. Place test files alongside source files with `.test.ts` extension.

```ts
import { test, expect } from "bun:test"

test("example", () => {
  expect(1).toBe(1)
})
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.
