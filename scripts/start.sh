#!/bin/bash

# Start all services (backend, frontend served by backend, and TRMNL plugin)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Starting PromptInk ==="
echo ""

# Start backend (serves frontend on port 3000)
"$SCRIPT_DIR/start-backend.sh"

echo ""

# Start TRMNL plugin preview server (port 4567)
"$SCRIPT_DIR/start-trmnl.sh"

echo ""
echo "=== PromptInk is running ==="
echo ""
echo "Services:"
echo "  - Main App:     http://localhost:3000"
echo "  - TRMNL Plugin: http://localhost:4567"
echo "  - TRMNL Webhook: http://localhost:3000/api/trmnl/webhook"
