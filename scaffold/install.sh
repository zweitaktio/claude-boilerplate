#!/bin/bash

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Project Installation ==="

# Enable corepack (once)
corepack enable

# Clean and install backend
echo ""
echo "=== Backend ==="
cd "$REPO_ROOT/backend"
yarn set version stable
rm -rf node_modules
yarn install

# Clean and install frontend
echo ""
echo "=== Frontend ==="
cd "$REPO_ROOT/frontend"
yarn set version stable
rm -rf node_modules
yarn install

# Clean and install services
echo ""
echo "=== Services ==="
cd "$REPO_ROOT/services"
yarn set version stable
rm -rf node_modules
yarn install

# Setup git hooks
echo ""
echo "=== Git Hooks ==="
"$REPO_ROOT/scripts/setup-hooks.sh"

echo ""
echo "=== Installation complete ==="
