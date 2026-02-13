#!/usr/bin/env bash
# Payload CMS REST API helper.
# Usage:
#   ./scripts/payload-api.sh GET  /products?limit=2&depth=0
#   ./scripts/payload-api.sh GET  /products/404?depth=2
#   ./scripts/payload-api.sh POST /products -d '{"title":"Test"}'
#
# Auth: set PAYLOAD_TOKEN or PAYLOAD_API_KEY env var for authenticated requests.
#   PAYLOAD_TOKEN=<jwt>         → Authorization: JWT <token>
#   PAYLOAD_API_KEY=<key>       → Authorization: users API-Key <key>
#
# Env:
#   PAYLOAD_URL  — base URL (default: http://localhost:3000)
#   PAYLOAD_JQ   — jq filter to apply to output (default: ".")

set -euo pipefail

PAYLOAD_URL="${PAYLOAD_URL:-http://localhost:3000}"
PAYLOAD_JQ="${PAYLOAD_JQ:-}"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <METHOD> <path> [curl-args...]" >&2
  echo "" >&2
  echo "Examples:" >&2
  echo "  $0 GET  /products?limit=2" >&2
  echo "  $0 GET  /products/404?depth=2" >&2
  echo "  $0 POST /products -d '{\"title\":\"Test\"}'" >&2
  echo "" >&2
  echo "Auth (env vars):" >&2
  echo "  PAYLOAD_TOKEN=<jwt>     — JWT auth" >&2
  echo "  PAYLOAD_API_KEY=<key>   — API key auth" >&2
  exit 1
fi

METHOD="$1"
PATH_AND_QUERY="$2"
shift 2

# Build auth header
AUTH_ARGS=()
if [ -n "${PAYLOAD_TOKEN:-}" ]; then
  AUTH_ARGS=(-H "Authorization: JWT ${PAYLOAD_TOKEN}")
elif [ -n "${PAYLOAD_API_KEY:-}" ]; then
  AUTH_ARGS=(-H "Authorization: users API-Key ${PAYLOAD_API_KEY}")
fi

RESPONSE=$(curl -s -X "$METHOD" \
  "${PAYLOAD_URL}/api${PATH_AND_QUERY}" \
  -H "Content-Type: application/json" \
  "${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"}" \
  "$@")

if [ -n "$PAYLOAD_JQ" ]; then
  echo "$RESPONSE" | jq "$PAYLOAD_JQ"
else
  echo "$RESPONSE" | jq .
fi
