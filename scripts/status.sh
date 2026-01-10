#!/bin/bash

# Check status of all services
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_PID_FILE="$PROJECT_ROOT/.backend.pid"
TRMNL_PID_FILE="$PROJECT_ROOT/.trmnl.pid"

echo "=== PromptInk Status ==="
echo ""

# Check backend
echo "Backend Server:"
if [ -f "$BACKEND_PID_FILE" ]; then
    PID=$(cat "$BACKEND_PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "  Status: Running (PID: $PID)"
        echo "  URL: http://localhost:3000"
    else
        echo "  Status: Stopped (stale PID file)"
    fi
else
    PIDS=$(pgrep -f "bun.*src/index.ts" 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "  Status: Running (PID: $PIDS)"
        echo "  URL: http://localhost:3000"
    else
        echo "  Status: Stopped"
    fi
fi

echo ""

# Check TRMNL plugin
echo "TRMNL Plugin Server:"

# Check Docker container first
if command -v docker &> /dev/null; then
    CONTAINER_ID=$(docker ps -q -f name=promptink-trmnl 2>/dev/null)
    if [ -n "$CONTAINER_ID" ]; then
        echo "  Status: Running (Docker: $CONTAINER_ID)"
        echo "  URL: http://localhost:4567"
        echo ""
        echo "Frontend: Served via backend at http://localhost:3000"
        exit 0
    fi
fi

# Check by PID file
if [ -f "$TRMNL_PID_FILE" ]; then
    PID=$(cat "$TRMNL_PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "  Status: Running (PID: $PID)"
        echo "  URL: http://localhost:4567"
    else
        echo "  Status: Stopped (stale PID file)"
    fi
else
    PIDS=$(pgrep -f "trmnlp.*serve" 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "  Status: Running (PID: $PIDS)"
        echo "  URL: http://localhost:4567"
    else
        echo "  Status: Stopped"
    fi
fi

echo ""
echo "Frontend: Served via backend at http://localhost:3000"
echo "TRMNL Webhook: http://localhost:3000/api/trmnl/webhook"
