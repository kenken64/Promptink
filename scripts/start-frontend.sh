#!/bin/bash

# Start frontend (served via backend)
# Note: The frontend is bundled and served by the backend server.
# This script is provided for consistency but simply starts the backend.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Note: Frontend is served via the backend server."
echo "Starting backend which serves the frontend..."
echo ""

"$SCRIPT_DIR/start-backend.sh"
