#!/bin/bash

# Install all dependencies
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo "=== Installing Dependencies ==="
echo ""

# Install backend dependencies
echo "Installing backend dependencies..."
cd "$BACKEND_DIR" || exit 1
bun install
echo "Backend dependencies installed."

echo ""

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd "$FRONTEND_DIR" || exit 1
bun install
echo "Frontend dependencies installed."

echo ""
echo "=== All dependencies installed ==="
