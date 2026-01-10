#!/bin/bash

# Stop the backend server
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_ROOT/.backend.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Stopping backend server (PID: $PID)..."
        kill "$PID"
        rm "$PID_FILE"
        echo "Backend stopped"
    else
        echo "Backend is not running (stale PID file)"
        rm "$PID_FILE"
    fi
else
    # Try to find and kill by process name
    PIDS=$(pgrep -f "bun.*src/index.ts" 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "Stopping backend server(s)..."
        echo "$PIDS" | xargs kill 2>/dev/null
        echo "Backend stopped"
    else
        echo "Backend is not running"
    fi
fi
