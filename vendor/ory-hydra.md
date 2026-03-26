---
version: 1.2.1
applies: "@ory/hydra-client" | "@ory/client"
target: rules
domain: auth
paths:
  - "**/auth/**"
  - "**/*.server.ts"
tags: [oauth2, hydra, auth, tokens, login, ory, identity]
---

# Ory Hydra (OAuth2)

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| Ory docs | https://www.ory.sh/docs/hydra | Official Hydra docs |
| API reference | https://www.ory.sh/docs/hydra/reference/api | REST API endpoints |
| SDK reference | https://www.ory.sh/docs/hydra/sdk | Client SDKs |
| GitHub | https://github.com/ory/hydra | Source, issues |
| Ory Network | https://console.ory.sh | Managed service dashboard |

## Client Architecture

Three-client pattern for separating concerns:

| Client | Grant Type | Purpose |
|--------|-----------|---------|
| `{app}-frontend` | `authorization_code` + `refresh_token` | User authentication |
| `{app}-m2m` | `client_credentials` | Frontend server → API (machine-to-machine) |
| `{app}-api` (or `payload-api`) | `client_credentials` | Token introspection |

## Login Flow (Authorization Code)

7-step flow for user authentication:

1. **Validate credentials** — POST to API (e.g. `/api/customers/validate`) with email/password
2. **Start OAuth flow** — GET `/oauth2/auth` with `client_id`, `redirect_uri`, `scope`, `state`, `nonce`
3. **Accept login challenge** — PUT Hydra admin `/admin/oauth2/auth/requests/login/accept` with subject
4. **Get consent challenge** — Follow redirect from step 3
5. **Accept consent challenge** — PUT Hydra admin `/admin/oauth2/auth/requests/consent/accept` with granted scopes
6. **Get authorization code** — Follow redirect from step 5
7. **Exchange code for tokens** — POST `/oauth2/token` with authorization code

### Critical: Cookie forwarding

Hydra uses CSRF tokens stored in cookies. You **must** capture and forward `set-cookie` headers between requests in the login flow:

```typescript
// Capture cookies from each response
const cookies = response.headers.getSetCookie()

// Forward them in the next request
fetch(nextUrl, {
  headers: { Cookie: cookies.join('; ') },
  redirect: 'manual',  // Handle redirects manually to capture cookies
})
```

### Critical: `redirect: 'manual'`

Use `redirect: 'manual'` for all Hydra requests in the login flow. Automatic redirects lose cookies and fail silently.

## Scopes

### Naming convention
```
payload:{collection}:{action}
```

Examples:
- `payload:customers:read`
- `payload:customers:update`
- `payload:orders:create`
- `hydra.introspect` — special scope for token introspection

### Required scopes per client
- **Frontend client**: `openid`, `offline_access`, `payload:customers:read`, `payload:customers:update`, etc.
- **M2M client**: All `payload:*` scopes the frontend server needs
- **API client**: `hydra.introspect`

**Use `offline_access` (NOT `offline`)** for refresh token support.

## Token Storage

- Store access + refresh tokens in **httpOnly cookie session** — never in localStorage
- Token refresh: check expiry before API calls, use refresh token if expired
- Clear session on logout + revoke tokens via Hydra admin

## Token Introspection

API validates incoming tokens via Hydra's introspection endpoint:

```typescript
const response = await fetch(`${HYDRA_ADMIN_URL}/admin/oauth2/introspect`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
  },
  body: `token=${accessToken}&scope=hydra.introspect`,
})

const { active, sub, scope } = await response.json()
```

## Access Control Functions

Reusable access control for Payload collections:

```typescript
// Check functions
isAdmin(req)                    // Payload admin user
isOAuth2User(req)               // Any authenticated OAuth2 user
isCustomer(req)                 // OAuth2 user with customer role
isService(req)                  // M2M service token
getOAuth2User(req)              // Get user from introspected token
hasScope(req, scope)            // Check single scope
hasAnyScope(req, scopes)        // Check any of multiple scopes

// Access policies (for collection config)
adminOnly()                           // Only Payload admins
adminOrScope(scope)                   // Admin or OAuth2 with scope
adminOrScopeOrSelf(scope, idField)    // + own record
adminOrScopeOrOwner(scope, field)     // + owned records
```

## M2M Token Acquisition

Server-to-server token for frontend → API calls:

```typescript
const response = await fetch(`${HYDRA_PUBLIC_URL}/oauth2/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${Buffer.from(`${M2M_CLIENT_ID}:${M2M_CLIENT_SECRET}`).toString('base64')}`,
  },
  body: 'grant_type=client_credentials&scope=payload:customers:read payload:orders:read',
})
```

Cache the M2M token until near expiry — don't fetch on every request.

## Development vs Production

| Setting | Development | Production |
|---------|------------|------------|
| `--dev` flag | Yes (relaxes requirements) | No |
| Admin API prefix | Optional | Required (`/admin/`) |
| TLS | Not required | Required for all endpoints |
| Redirect URIs | `http://localhost:*` | Exact HTTPS URIs only |

## Known Issues

### Cookie domain mismatch
In development with separate ports (frontend:5173, Hydra:4444), cookies may not be forwarded. Ensure all services share the same domain or use a proxy.

### Consent screen skip
For first-party apps, set `skip_consent: true` in the client config to avoid showing unnecessary consent screens to your own users.

## Pitfalls

### Cookie security defaults

Always set security flags on cookies that hold tokens or session data:

```typescript
import { createCookie } from 'react-router'

export const sessionCookie = createCookie('session', {
  httpOnly: true,     // Not accessible via JavaScript
  sameSite: 'lax',    // Prevents CSRF on cross-origin POSTs
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
  maxAge: 60 * 60 * 24 * 7,  // 7 days
})
```

**Never:** omit `httpOnly` on auth cookies, use `sameSite: 'none'` without a strong reason, or set `secure: false` in production.
