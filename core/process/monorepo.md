---
version: 2.3.1
applies: Always
target: rules
priority: high
paths:
  - "packages/**"
  - "apps/**"
  - "services/**"
  - "backend/**"
  - "frontend/**"
  - "scripts/**"
  - "docker-compose*"
  - "dev.sh"
  - "install.sh"
tags: [monorepo, directory, scripts, lifecycle]
---

# Monorepo Conventions

## Directory Layout

```
project/
├── backend/       # API + admin (Payload CMS / Next.js)
├── frontend/      # SSR storefront (React Router 8)
├── services/      # Docker, sync tools, E2E tests
├── scripts/       # Git hooks, setup scripts
├── .github/       # CI/CD workflows
├── dev.sh         # Tmux dev launcher
├── install.sh     # Bootstrap script
└── CLAUDE.md
```

Each directory is autonomous — own `package.json`, own `node_modules`, no yarn workspaces. There is no shared workspace — treat each as an independent project.

## Know Your Working Directory

Each workspace has its own `package.json` and `node_modules`. Commands like `yarn check` or `yarn dev` only work when run from the correct workspace root.

Before running any command, confirm you're in the right directory — via `pwd`, `cd`, absolute paths, or the `cwd` option on the Bash tool. The mechanism doesn't matter; what matters is that the command executes in the correct workspace.

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
| Backend | 3000 | `backend/.logs/dev-server.log` |
| Frontend | 5173 | `frontend/.logs/dev-server.log` |
| Stripe | — | `services/.logs/stripe.log` |
| PostgreSQL | 5432 | — |
| Meilisearch | 7700 | — |
| Mailpit UI | 8025 | — |
| Mailpit SMTP | 1025 | — |
| Hydra public | 4444 | — |
| Hydra admin | 4445 | — |

Never start dev servers — assume they're running. **To debug server issues:** read the log file with the Read tool, don't restart the server.

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

See `core/tooling` for `yarn check`, `yarn build`, and verification workflow.

For cross-workspace type sync after backend collection changes:
```bash
cd backend && yarn generate:types && yarn copytypes
cd ../frontend && yarn check
```
