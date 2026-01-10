#!/bin/bash

# Start the TRMNL plugin preview server
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TRMNL_DIR="$PROJECT_ROOT/peekachoo-trmnl"
PID_FILE="$PROJECT_ROOT/.trmnl.pid"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "TRMNL plugin server is already running (PID: $PID)"
        exit 1
    fi
fi

cd "$TRMNL_DIR" || exit 1

echo "Starting TRMNL plugin server..."

# Check if trmnlp is installed globally
if command -v trmnlp &> /dev/null; then
    trmnlp serve > "$PROJECT_ROOT/logs/trmnl.log" 2>&1 &
    PID=$!
elif command -v docker &> /dev/null; then
    # Use Docker
    docker run \
        -d \
        --rm \
        --name promptink-trmnl \
        --publish 4567:4567 \
        --volume "$(pwd):/plugin" \
        trmnl/trmnlp serve > /dev/null 2>&1
    # Get the container ID as "PID" for tracking
    PID=$(docker ps -q -f name=promptink-trmnl)
else
    echo "Error: Neither trmnlp nor docker is installed"
    echo "Install with: gem install trmnl_preview"
    echo "Or install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo $PID > "$PID_FILE"
echo "TRMNL plugin server started (PID/Container: $PID)"
echo "Logs: $PROJECT_ROOT/logs/trmnl.log"
echo "URL: http://localhost:4567"
