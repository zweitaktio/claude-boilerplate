---
version: 1.1.0
applies: Always
target: rules
tags: [security, auth, validation, XSS, CSRF, injection]
---

# Security Review Checklist

## Input Validation
- Validate all user input at system boundaries (routes, API endpoints)
- Use allowlists over denylists (regex for slugs, enum for types, etc.)
- Validate file paths to prevent traversal

## Authentication & Sessions
- Never expose session IDs in URLs or logs
- Use `httpOnly`, `sameSite: strict`, `secure` on cookies
- Use `crypto.timingSafeEqual` for secret comparison
- Bound rate limiters (cap map size, evict expired entries)

## Server-Side
- Never trust client-provided paths for file operations
- Sanitize all user input before passing to shell commands
- Use parameterized queries (never string interpolation for SQL)

## Frontend
- Escape user content in templates
- Use `rel="noopener noreferrer"` on external links with `target="_blank"`
- Don't store secrets in client-accessible code
- Never access APIs directly from client — always through loaders/actions
- Use `.server.ts` suffix for server-only code

## Audit Logging

Log security-relevant events with structured data:
- `login_success`, `login_failure` — with userId, IP
- `token_refresh`, `password_change` — with userId
- `access_denied` — with userId, resource, reason

Include: `audit: true` flag, IP address, user ID, resource path, timestamp (automatic via logger).

## Rate Limiting Guidelines

Apply at the proxy level (Caddy, nginx) or application level:

| Endpoint type | Limit |
|--------------|-------|
| Normal API | 100/min |
| Login / auth | 10/min |
| Password reset | 5/min |
| File uploads | 20/min |

## See Also

- `core/code-review` — Security in code review priority (auto-loaded)
- KG entity `VendorReactRouter7Routing` — Protected route patterns (`search_nodes("domain: routing")`)
- `core/ssr-hydration` — Server-only code patterns (auto-loaded)
