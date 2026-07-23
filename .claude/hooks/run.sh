#!/bin/bash
# Dispatch a hook by name. Prefers a .ts file (run via bun, or node --experimental-strip-types),
# falling back to .mjs during the TS transition. bun is recommended; node >= 22.6 runs .ts via strip-types.
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
NAME="$1"
if [ -f "$HOOK_DIR/$NAME.ts" ]; then
  FILE="$HOOK_DIR/$NAME.ts"
else
  FILE="$HOOK_DIR/$NAME.mjs"
fi
if command -v bun >/dev/null 2>&1; then
  exec bun "$FILE"
elif [ "${FILE##*.}" = "ts" ]; then
  exec node --experimental-strip-types "$FILE"
else
  exec node "$FILE"
fi
