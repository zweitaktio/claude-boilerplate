---
version: 2.0.1
applies: Always
target: rules
priority: high
tags: [monorepo, directory, scripts, lifecycle]
---

# Monorepo Conventions

## Directory Layout

```
project/
├── backend/       # API + admin (Payload CMS / Next.js)
├── frontend/      # SSR storefront (React Router 7)
├── services/      # Docker, sync tools, E2E tests
├── scripts/       # Git hooks, setup scripts
├── .github/       # CI/CD workflows
├── dev.sh         # Tmux dev launcher
├── install.sh     # Bootstrap script
└── CLAUDE.md
```

Each directory is autonomous — own `package.json`, own `node_modules`, no yarn workspaces. There is no shared workspace — treat each as an independent project.

## First Action: cd Into the Right Directory

When starting a task, identify which part of the monorepo it belongs to and `cd` there before doing anything else.

```bash
cd frontend  # Frontend task
cd backend   # Backend task
cd services  # Docker, sync, E2E
```

## Standard Script Names

Every package uses the same script names. Learn once, use everywhere.

| Script | Backend | Frontend | Services |
|--------|---------|----------|----------|
| `yarn dev` | Dev server (:3000) | Dev server (:5173) | — |
| `yarn build` | Production build | Production build | — |
| `yarn check` | typecheck + lint + format | typecheck + lint + format | — |
| `yarn start` | Run prod server | — | Docker up + OAuth setup |
| `yarn stop` | — | — | Docker down |
| `yarn destroy` | — | — | Docker down + volumes |
| `yarn sync` | — | — | Sync prod DB + R2 storage |
| `yarn copytypes` | Generate + copy to FE | Copy from BE | — |
| `yarn test:run` | Unit tests (Vitest) | Unit tests (Vitest) | — |

## Type Flow

Backend generates types, copies to frontend. Frontend never generates its own Payload types.

1. Backend: `yarn generate:types` produces `src/payload-types.ts`
2. Backend: `yarn copytypes` copies to `frontend/app/services/api/payload/`
3. Copied files get `// @ts-nocheck` header
4. Frontend `tsconfig.json` excludes copied type files

After backend collection changes:

```bash
cd backend && yarn generate:types && yarn copytypes
cd ../frontend && yarn check
```

## Ports & Logs

| Component | Port | Log file |
|-----------|------|----------|
| Backend | 3000 | `/tmp/backend.log` |
| Frontend | 5173 | `/tmp/frontend.log` |
| Stripe | — | `/tmp/stripe.log` |
| PostgreSQL | 5432 | — |
| Meilisearch | 7700 | — |
| Mailpit UI | 8025 | — |
| Mailpit SMTP | 1025 | — |
| Hydra public | 4444 | — |
| Hydra admin | 4445 | — |

Never start dev servers — assume they're running. Read log files to debug.

## Services Lifecycle

```bash
cd services
yarn start     # Start Docker services (PostgreSQL, Meilisearch, Mailpit, Hydra)
yarn stop      # Stop services (preserves data volumes)
yarn destroy   # Stop + remove data volumes (full reset)
yarn sync      # Sync production DB + R2 to local
yarn status    # Verify all connections
```

## Verification

`yarn check` runs automatically via PostToolUse hook in the workspace where the file was edited. Each package is verified separately — the hook walks up from the edited file to find the nearest `package.json` with a `check` script.

See `core/process/tooling` for full verification workflow.
