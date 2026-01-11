# Use official Bun image
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies for both frontend and backend
FROM base AS deps

# Copy package files
COPY backend/package.json backend/bun.lockb* ./backend/
COPY frontend/package.json frontend/bun.lockb* ./frontend/

# Install backend dependencies
WORKDIR /app/backend
RUN bun install --frozen-lockfile || bun install

# Install frontend dependencies
WORKDIR /app/frontend
RUN bun install --frozen-lockfile || bun install

# Production build
FROM base AS release

# Copy installed dependencies
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules

# Copy source code
COPY backend ./backend
COPY frontend ./frontend

# Build frontend for production (JS bundle + Tailwind CSS)
WORKDIR /app/frontend
RUN bun run build

WORKDIR /app/backend

# Note: /app/data directory is created by Railway volume mount
# Do NOT create it here as it can interfere with volume mounting

# Environment variables (Railway injects these at runtime)
ENV NODE_ENV=production
ENV DB_PATH=/app/data/promptink.db
# Required env vars (set via Railway dashboard):
# - PORT (auto-set by Railway)
# - JWT_SECRET
# - OPENAI_API_KEY
#
# Optional env vars (for global TRMNL operations, users configure their own in Settings):
# - TRMNL_USER_API_KEY (for admin TRMNL API access)
# - TRMNL_CUSTOM_PLUGIN_UUID (for custom plugin operations)
#
# Note: TRMNL_DEVICE_API_KEY and TRMNL_MAC_ADDRESS are now per-user settings
# stored in the database. Users configure these in the Settings page.

# Expose port (Railway sets PORT env var automatically)
EXPOSE 3000

# Run the server
CMD ["bun", "src/index.ts"]
