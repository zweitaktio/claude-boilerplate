---
version: 1.0.0
applies: payload
target: rules
paths:
  - "scripts/payload-*"
  - "backend/**"
tags: [payload, api, scripts, rest]
---

# Payload API Scripts

Helper scripts for querying the Payload CMS REST API from the CLI. Use these instead of raw `curl` commands.

## `scripts/payload-api.sh` — REST API requests

```bash
# Public endpoints
./scripts/payload-api.sh GET '/products?limit=2&depth=0'
./scripts/payload-api.sh GET '/products/404?depth=2'

# With jq filter
PAYLOAD_JQ='{totalDocs, title: .docs[0].title}' ./scripts/payload-api.sh GET '/products?limit=1'

# Authenticated (JWT from token script)
PAYLOAD_TOKEN=$(...) ./scripts/payload-api.sh GET '/users?limit=1'

# Authenticated (API key)
PAYLOAD_API_KEY=<key> ./scripts/payload-api.sh GET '/users?limit=1'

# POST with body
./scripts/payload-api.sh POST '/products' -d '{"title":"Test"}'
```

## `scripts/payload-token.sh` — Get a JWT token

```bash
./scripts/payload-token.sh <email> <password>
# Outputs raw JWT token on success, error to stderr on failure
```

Env: `PAYLOAD_URL` overrides the default `http://localhost:3000`.
