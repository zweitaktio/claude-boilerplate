---
version: 1.0.0
vendor: VendorPayloadCms3
source_template: vendor/payload-cms-3.md
applies: payload@3
tags: [payload, migrations, dev, auto-apply]
---

# Payload migrations auto-apply in dev mode

Pitfall: Payload automatically runs pending migrations when the dev server starts. Running `migrate` manually in local dev can cause double-application or conflicts.

## Symptom

Migration errors on dev server startup after manually running `yarn payload migrate`. Or: columns/tables already exist errors.

## Root Cause

Payload's dev mode checks for pending migrations on startup and applies them automatically. If you also run `yarn payload migrate` manually, the migration may be applied twice — or the manual run applies it before the dev server records it, causing a state mismatch.

## Fix

Only use `migrate:create` to generate migration files in local dev. Never run `migrate` manually — let the dev server auto-apply on next restart.

```bash
# ✅ Create a migration file
yarn payload migrate:create

# ❌ Never do this in local dev
yarn payload migrate
```

## Prevention

Treat `migrate:create` as the only migration command for local development. The dev server handles application. Manual `migrate` is only for production/staging deployments where the server doesn't auto-apply.
