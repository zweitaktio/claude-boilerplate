---
version: 1.0.1
applies: Always
target: rules
domain: tooling
tags: [scaffolding, monorepo, docker, dev-scripts, lifecycle, migration, sync, oauth]
---

# Project Scaffolding Reference

Baseline files for monorepo projects live in `~/.claude/skills/webstack/scaffold/`. These are static baselines with `myproject` as placeholder — copy and edit for your project.

## What's in scaffold/

```
scaffold/
├── dev.sh                    # Tmux dev launcher (backend + frontend + optional stripe)
├── install.sh                # Bootstrap: clean install all packages + git hooks
├── scripts/
│   ├── pre-commit            # Runs yarn check on modified workspaces only
│   └── setup-hooks.sh        # Symlinks pre-commit to .git/hooks/
├── services/
│   ├── docker-compose.dev.yml  # PostgreSQL, Mailpit, Meilisearch, Hydra (optional)
│   ├── package.json            # start/stop/destroy/sync scripts
│   ├── tsconfig.json           # ES2022, strict, bundler
│   ├── .env.example            # All env vars documented
│   ├── config/hydra/hydra.yml  # Hydra dev config (optional)
│   ├── scripts/setup-hydra-clients.ts     # Dev OAuth setup (optional)
│   ├── deployment/hydra/setup-clients.sh  # Prod OAuth setup (optional)
│   ├── deployment/hydra/hydra.yml         # Prod Hydra config (optional)
│   └── src/                    # Sync CLI
│       ├── cli.ts              # Commander-based CLI (sync, check commands)
│       ├── config.ts           # Env var loading with lazy getters
│       ├── sync/database.ts    # SSH + docker pg_dump -> local restore
│       ├── sync/r2.ts          # S3-compatible bucket sync (ETag diff)
│       └── utils/              # Logger, confirm prompt
├── .github/
│   ├── README.md               # CI/CD documentation
│   └── workflows/
│       ├── _build-deploy.yml   # Reusable: build -> push -> Dokploy deploy
│       ├── deploy-staging.yml  # Push to main -> path filter -> build changed
│       └── deploy-prod.yml    # Semver tag -> path filter -> build changed
├── backend/
│   ├── scripts/copy-types.mjs  # Type sync: BE -> FE with @ts-nocheck
│   └── Dockerfile              # Multi-stage Next.js build
└── frontend/
    └── Dockerfile              # Multi-stage React Router build
```

## Convention Rationale

**Why no yarn workspaces?** Each package has different Node requirements, build tools, and deployment targets. Workspaces add coupling without benefit when packages don't share code.

**Why file-copy for types?** Payload CMS generates TypeScript types from collections. The frontend needs these types but can't import from backend directly (different builds, different runtimes). File copy with `@ts-nocheck` is the simplest reliable approach.

**Why SSH + docker exec for DB sync?** Production databases run inside Docker on the server. Direct connections aren't exposed. SSH tunnel + `docker exec pg_dump` is the standard pattern for Dokploy/Coolify deployments.

**Why R2 ETag diffing?** Cloudflare R2 is S3-compatible. Comparing ETags + file sizes avoids re-uploading unchanged files, making incremental syncs fast.

## Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL 16 | 5432 | Primary database |
| Mailpit | 8025/1025 | Email testing (UI + SMTP) |
| Meilisearch | 7700 | Full-text search |
| Ory Hydra | 4444/4445 | OAuth2 provider (optional) |

`yarn start` brings up all services. `yarn stop` preserves data volumes. `yarn destroy` removes everything including data.

## Sync Architecture

### Database Sync

1. SSH to production server (key-based auth)
2. `docker exec <container> pg_dump` — stream dump to local `/tmp/`
3. Drop and recreate local database (template0 to avoid collation issues)
4. `docker cp` dump into postgres container, `psql` restore
5. Clean up temp files

Supports both local and remote test targets via `--target` flag.

### R2 Storage Sync

1. List all objects in production bucket (paginated)
2. List objects in target bucket
3. Compare by ETag + Size — skip unchanged
4. Download from prod, upload to target
5. Report stats (copied/skipped/errors/bytes)

### CLI Usage

```bash
cd services
yarn sync              # Full sync (DB + R2) to local
yarn sync:db           # Database only
yarn sync:r2           # R2 storage only
yarn sync --dry-run    # Preview without changes
yarn sync --target test  # Sync to test/staging instead
yarn status            # Check all connections
```

## OAuth Setup (Hydra)

### Development

`yarn start` runs `setup-hydra-clients.ts` after Docker services are up. Creates three OAuth clients:

1. **Frontend** — authorization code flow for user auth
2. **M2M** — client credentials for server-to-server
3. **API** — client credentials for token introspection

### Production

Use `deployment/hydra/setup-clients.sh` which reads secrets from `.env` and uses idempotent PUT-or-POST logic. Hydra config uses env vars instead of hardcoded URLs.

## CI/CD Pipeline

Path-filtered GitHub Actions with Dokploy deployment:

- **Staging**: Push to `main` builds only changed services, pushes `:staging` tag
- **Production**: Semver tag push builds only changed services, pushes `:prod` tag
- Reusable `_build-deploy.yml` handles Docker build + push + Dokploy deploy

## Dockerfile Patterns

Both backend and frontend use identical multi-stage patterns:

1. **base** — Node Alpine + corepack
2. **system-deps** — apk packages (libc6-compat)
3. **deps** — `yarn --immutable` (cached when package.json unchanged)
4. **builder** — Copy source, run tests, build
5. **runner** — Minimal production image, non-root user, health check

Backend-specific: Next.js standalone output, `.next/standalone` + `.next/static`
Frontend-specific: `yarn workspaces focus --production` to prune dev deps

## Migration Checklist

For existing projects adopting these conventions:

1. **Directory structure**: Move code into `backend/`, `frontend/`, `services/`
2. **Script names**: Rename to match the standard table (see `core/monorepo`)
3. **Root scripts**: Copy `dev.sh`, `install.sh`, `scripts/` from scaffold
4. **Docker services**: Copy `services/docker-compose.dev.yml`, configure for your DB name
5. **Type sharing**: Add `copy-types.mjs` if backend generates types for frontend
6. **Sync tools**: Copy `services/src/`, configure `.env` with production credentials
7. **CI/CD**: Copy `.github/workflows/`, update registry URLs and Dokploy IDs
8. **CLAUDE.md**: Update commands, architecture, vendor knowledge sections
9. **Claude rules**: Run `/webstack init` to deploy `.claude/rules/`
10. **Replace placeholders**: Search for `myproject` and replace with your project name
