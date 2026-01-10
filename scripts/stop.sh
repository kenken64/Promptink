#!/bin/bash

# Stop all services gracefully
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Stopping PromptInk ==="
echo ""

# Stop TRMNL plugin server first
"$SCRIPT_DIR/stop-trmnl.sh"

echo ""

# Stop backend server
"$SCRIPT_DIR/stop-backend.sh"

echo ""
echo "=== PromptInk stopped ==="
