#!/usr/bin/env bash
# Get a Payload CMS auth token for the users collection.
# Usage: ./scripts/payload-token.sh <email> <password>
# Outputs the JWT token on success.

set -euo pipefail

PAYLOAD_URL="${PAYLOAD_URL:-http://localhost:3000}"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <email> <password>" >&2
  exit 1
fi

EMAIL="$1"
PASSWORD="$2"

RESPONSE=$(curl -s -X POST "${PAYLOAD_URL}/api/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo "$RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  ERROR=$(echo "$RESPONSE" | jq -r '.errors[0].message // .message // "Unknown error"')
  echo "Login failed: ${ERROR}" >&2
  exit 1
fi

echo "$TOKEN"
