#!/bin/bash
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
if command -v bun >/dev/null 2>&1; then
  exec bun "$HOOK_DIR/$1.mjs"
else
  exec node "$HOOK_DIR/$1.mjs"
fi
