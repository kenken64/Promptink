#!/bin/bash

# Stop the TRMNL plugin server
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_ROOT/.trmnl.pid"

# First try to stop Docker container if it exists
if command -v docker &> /dev/null; then
    if docker ps -q -f name=promptink-trmnl > /dev/null 2>&1; then
        CONTAINER_ID=$(docker ps -q -f name=promptink-trmnl)
        if [ -n "$CONTAINER_ID" ]; then
            echo "Stopping TRMNL Docker container..."
            docker stop promptink-trmnl > /dev/null 2>&1
            echo "TRMNL container stopped"
            rm -f "$PID_FILE"
            exit 0
        fi
    fi
fi

# Try to stop by PID file
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Stopping TRMNL plugin server (PID: $PID)..."
        kill "$PID"
        rm "$PID_FILE"
        echo "TRMNL plugin server stopped"
    else
        echo "TRMNL plugin server is not running (stale PID file)"
        rm "$PID_FILE"
    fi
else
    # Try to find and kill by process name
    PIDS=$(pgrep -f "trmnlp.*serve" 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "Stopping TRMNL plugin server(s)..."
        echo "$PIDS" | xargs kill 2>/dev/null
        echo "TRMNL plugin server stopped"
    else
        echo "TRMNL plugin server is not running"
    fi
fi
