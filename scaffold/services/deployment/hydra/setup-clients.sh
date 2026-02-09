#!/bin/bash
# Setup OAuth2 clients in Hydra (production/staging)
# Run this after Hydra is up and running.
#
# Usage:
#   ./setup-clients.sh              # Uses .env file from current dir
#   ./setup-clients.sh .env.staging # Uses specific env file
#
# Requires environment variables (see .env.example)

set -e

# Load environment variables from specified file or default .env
ENV_FILE="${1:-.env}"
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment from: $ENV_FILE"
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "Warning: $ENV_FILE not found, using existing environment variables"
fi

ADMIN_URL="${HYDRA_ADMIN_URL:-http://localhost:4445}"

echo ""
echo "=========================================="
echo "  Hydra OAuth2 Client Setup"
echo "=========================================="
echo ""
echo "Admin URL: $ADMIN_URL"
echo ""

# Validate required variables
check_required() {
  local var_name=$1
  local var_value="${!var_name}"
  if [ -z "$var_value" ]; then
    echo "ERROR: Required variable $var_name is not set"
    exit 1
  fi
}

check_required "OAUTH_CLIENT_SECRET"
check_required "M2M_CLIENT_SECRET"
check_required "PAYLOAD_OAUTH_CLIENT_SECRET"
check_required "OAUTH_REDIRECT_URI"

# Wait for Hydra to be ready
echo "Waiting for Hydra to be ready..."
max_attempts=30
attempt=0
until curl -s "$ADMIN_URL/health/ready" > /dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "ERROR: Hydra did not become ready after $max_attempts attempts"
    exit 1
  fi
  echo "  Attempt $attempt/$max_attempts - Hydra not ready yet, waiting..."
  sleep 2
done
echo "Hydra is ready!"
echo ""

# Function to create or update a client
create_client() {
  local client_id=$1
  local client_name=$2
  local payload=$3

  echo "----------------------------------------"
  echo "Client: $client_name ($client_id)"
  echo "----------------------------------------"

  # Check if client exists
  existing=$(curl -s "$ADMIN_URL/admin/clients/$client_id" 2>/dev/null)

  if echo "$existing" | grep -q "\"client_id\":\"$client_id\""; then
    echo "  -> Client exists, updating..."
    response=$(curl -s -X PUT "$ADMIN_URL/admin/clients/$client_id" \
      -H "Content-Type: application/json" \
      -d "$payload")
  else
    echo "  -> Creating new client..."
    response=$(curl -s -X POST "$ADMIN_URL/admin/clients" \
      -H "Content-Type: application/json" \
      -d "$payload")
  fi

  if echo "$response" | grep -q "\"client_id\":\"$client_id\""; then
    echo "  Success!"
  else
    echo "  Error: $response"
    return 1
  fi
  echo ""
}

# =============================================================================
# Frontend Client — user authentication via authorization code flow
# =============================================================================
create_client "${OAUTH_CLIENT_ID:-myproject-frontend}" "Frontend Auth" "{
  \"client_id\": \"${OAUTH_CLIENT_ID:-myproject-frontend}\",
  \"client_name\": \"Frontend\",
  \"client_secret\": \"${OAUTH_CLIENT_SECRET}\",
  \"grant_types\": [\"authorization_code\", \"refresh_token\"],
  \"redirect_uris\": [\"${OAUTH_REDIRECT_URI}\"],
  \"post_logout_redirect_uris\": [\"${HYDRA_POST_LOGOUT_URL:-}\"],
  \"response_types\": [\"code\"],
  \"scope\": \"openid offline offline_access profile email\",
  \"subject_type\": \"public\",
  \"token_endpoint_auth_method\": \"client_secret_post\",
  \"skip_consent\": true,
  \"skip_logout_consent\": true
}"

# =============================================================================
# M2M Client — server-to-server communication (frontend server -> backend API)
# =============================================================================
create_client "${M2M_CLIENT_ID:-myproject-m2m}" "Machine-to-Machine" "{
  \"client_id\": \"${M2M_CLIENT_ID:-myproject-m2m}\",
  \"client_name\": \"M2M\",
  \"client_secret\": \"${M2M_CLIENT_SECRET}\",
  \"grant_types\": [\"client_credentials\"],
  \"response_types\": [\"token\"],
  \"scope\": \"payload:read payload:write\",
  \"token_endpoint_auth_method\": \"client_secret_basic\"
}"

# =============================================================================
# Backend Introspection Client — validates tokens from frontend
# =============================================================================
create_client "${PAYLOAD_OAUTH_CLIENT_ID:-myproject-api}" "Backend API" "{
  \"client_id\": \"${PAYLOAD_OAUTH_CLIENT_ID:-myproject-api}\",
  \"client_name\": \"Backend Introspection\",
  \"client_secret\": \"${PAYLOAD_OAUTH_CLIENT_SECRET}\",
  \"grant_types\": [\"client_credentials\"],
  \"response_types\": [\"token\"],
  \"scope\": \"hydra.introspect\",
  \"token_endpoint_auth_method\": \"client_secret_basic\"
}"

echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Clients configured:"
echo "  - ${OAUTH_CLIENT_ID:-myproject-frontend} (user auth)"
echo "  - ${M2M_CLIENT_ID:-myproject-m2m} (server-to-server)"
echo "  - ${PAYLOAD_OAUTH_CLIENT_ID:-myproject-api} (token introspection)"
echo ""
echo "Verify at: $ADMIN_URL/admin/clients"
echo ""
