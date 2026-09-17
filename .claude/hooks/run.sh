#!/bin/bash
# Dispatch a hook by name. Prefers a .ts file (run via bun, or node --experimental-strip-types).
# Every hook in this repository is .ts. The .mjs branch stays for a target project that still holds
# a deployed .mjs hook from before the migration; sync.sh prunes those on the next update.
# bun is recommended; node >= 22.6 runs .ts via strip-types.
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
NAME="$1"
if [ -f "$HOOK_DIR/$NAME.ts" ]; then
  FILE="$HOOK_DIR/$NAME.ts"
else
  FILE="$HOOK_DIR/$NAME.mjs"
fi

# PATH goes stale mid-session. An nvm upgrade removes the version directory that PATH and NVM_BIN
# still name, and every hook then dies with "node: not found" while the session keeps running.
# A hook that cannot start enforces nothing, so look on disk before you give up. PATH wins when it
# resolves, because that runtime is the one the project tests against.
find_runtime() {
  if command -v bun >/dev/null 2>&1; then command -v bun; return 0; fi
  if command -v node >/dev/null 2>&1; then command -v node; return 0; fi
  for candidate in "$BUN_INSTALL/bin/bun" "$HOME/.bun/bin/bun" "$NVM_BIN/node"; do
    if [ -x "$candidate" ]; then echo "$candidate"; return 0; fi
  done
  # nvm names each directory vMAJOR.MINOR.PATCH. Sort on the bare version, not on the path, because
  # a path sort reads the home directory first and then v9 outranks v26.
  newest="$(ls -1d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null |
    sed 's|.*/node/v\([^/]*\)/bin/node|\1 &|' |
    sort -t. -k1,1n -k2,2n -k3,3n | tail -1 | sed 's|^[^ ]* ||')"
  if [ -x "$newest" ]; then echo "$newest"; return 0; fi
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [ -x "$candidate" ]; then echo "$candidate"; return 0; fi
  done
  return 1
}

RUNTIME="$(find_runtime)"
if [ -z "$RUNTIME" ]; then
  echo "hook $NAME did not run: no bun and no node found." >&2
  echo "PATH names a runtime that is gone. Restart the session, or install bun." >&2
  exit 1
fi

case "$RUNTIME" in
*/bun) exec "$RUNTIME" "$FILE" ;;
esac
if [ "${FILE##*.}" = "ts" ]; then
  exec "$RUNTIME" --experimental-strip-types "$FILE"
fi
exec "$RUNTIME" "$FILE"
