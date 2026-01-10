#!/bin/bash

# Start the backend server
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
PID_FILE="$PROJECT_ROOT/.backend.pid"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Backend is already running (PID: $PID)"
        exit 1
    fi
fi

# Install backend dependencies
echo "Installing backend dependencies..."
cd "$BACKEND_DIR" || exit 1
bun install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd "$FRONTEND_DIR" || exit 1
bun install

# Start the server
cd "$BACKEND_DIR" || exit 1

echo ""
echo "Starting backend server..."
bun --hot src/index.ts > "$PROJECT_ROOT/logs/backend.log" 2>&1 &
PID=$!

echo $PID > "$PID_FILE"
echo "Backend started (PID: $PID)"
echo "Logs: $PROJECT_ROOT/logs/backend.log"
echo "URL: http://localhost:3000"
