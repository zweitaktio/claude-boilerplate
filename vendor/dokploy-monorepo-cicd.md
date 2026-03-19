---
version: 2.0.0
applies: dokploy | .github/workflows/*dokploy* | .github/workflows/*deploy*
target: graph
domain: cicd
tags: [dokploy, cicd, deployment, github-actions, docker, monorepo]
---

# Dokploy Monorepo CI/CD

Reusable GitHub Actions workflow pattern for monorepo deployments with path-based filtering, SHA-based image tagging, and Dokploy integration via direct API calls.

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| Dokploy docs | https://docs.dokploy.com | Official docs |
| Dokploy GitHub | https://github.com/Dokploy/dokploy | Source, issues |
| Dokploy API | https://docs.dokploy.com/api | REST API reference |
| paths-filter | https://github.com/dorny/paths-filter | `dorny/paths-filter` for change detection |
| Docker build-push | https://github.com/docker/build-push-action | `docker/build-push-action` |
| GHA reusable workflows | https://docs.github.com/en/actions/using-workflows/reusing-workflows | `workflow_call` pattern |

## Overview

This pattern provides:
- **Path-based filtering** — only build/deploy services with actual changes
- **SHA-based image tags** — exact version tracking via `IMAGE_TAG` env var (replaces fixed alias tags)
- **Separated concerns** — 6 reusable workflows for build, deploy, update-env, verify, stop, test
- **Atomic env updates** — safely patches only `IMAGE_TAG` in Dokploy env, with diff verification and rollback
- **Version verification** — polls `/api/version` endpoint until deployed SHA matches expected tag
- **Staging on push** — deploy to staging when pushing to `main`
- **Production on tag** — deploy to production when pushing semver tags (e.g. `1.2.3`)
- **Stop-staging gate** — production deploy stops staging after verification succeeds

## File Structure

```
.github/
├── README.md
└── workflows/
    ├── _build.yml              # Build & push Docker image (TAG baking, extra-tags, SHA tagging)
    ├── _deploy.yml             # Deploy via Dokploy API (trigger + poll for completion)
    ├── _update-env.yml         # Patch IMAGE_TAG in Dokploy env (safe diff + rollback)
    ├── _verify-version.yml     # Poll /api/version until SHA matches
    ├── _stop.yml               # Stop Dokploy compose
    ├── _test.yml               # Run yarn test:run in service context
    ├── deploy-staging.yml      # Staging orchestration (push to main)
    └── deploy-prod.yml         # Production orchestration (semver tag)
```

## Pipeline Flow

```
changes (path-filter + short SHA)
  → test (per service, if tests exist)
  → build (parallel per service, TAG baking)
  → update-env (both builds gate ALL update-envs — prevents partial state)
  → deploy (per service)
  → verify (poll /api/version for SHA match)
  → stop-staging (prod only, after verify)
```

Key: both builds must succeed before ANY update-env runs. This prevents partial deployment state where one service has a new IMAGE_TAG but the other build failed.

## Reusable Workflows

### `_build.yml` — Build & Push

```yaml
# Inputs: service, context, image, tag, extra-tags (optional)
# Bakes TAG as build-arg, adds sha-{short} tag, supports extra-tags for :latest/:version
uses: ./.github/workflows/_build.yml
with:
  service: backend
  context: ./backend
  image: registry.example.com/myproject/backend
  tag: ${{ needs.changes.outputs.image-tag }}
  extra-tags: |                                    # Production only
    registry.example.com/myproject/backend:latest
    registry.example.com/myproject/backend:${{ github.ref_name }}
secrets: inherit
```

The `TAG` build-arg is available in your Dockerfile for baking the version into the image:

```dockerfile
ARG TAG=dev
ENV APP_VERSION=$TAG
```

### `_deploy.yml` — Deploy via Dokploy API

```yaml
# Inputs: dokploy-compose-id, title (optional)
# Triggers compose.deploy, polls compose.one for completion (180s timeout)
uses: ./.github/workflows/_deploy.yml
with:
  dokploy-compose-id: ${{ vars.DOKPLOY_COMPOSE_ID_STAGING_BACKEND }}
  title: ${{ needs.changes.outputs.image-tag }}
secrets: inherit
```

Direct `curl` to Dokploy API — no third-party action dependency.

### `_update-env.yml` — Safe Env Patching

```yaml
# Inputs: dokploy-compose-id, image-tag
# GET env → patch IMAGE_TAG → diff verify → POST update → re-read verify (rollback on failure)
uses: ./.github/workflows/_update-env.yml
with:
  dokploy-compose-id: ${{ vars.DOKPLOY_COMPOSE_ID_STAGING_BACKEND }}
  image-tag: ${{ needs.changes.outputs.image-tag }}
secrets: inherit
```

Safety: rejects if any non-IMAGE_TAG lines changed. Rolls back on verification failure.

### `_verify-version.yml` — Version Verification

```yaml
# Inputs: url, expected-tag, basic-auth (optional)
# Polls {url}/api/version, compares .sha with expected-tag (180s timeout, 10s interval)
uses: ./.github/workflows/_verify-version.yml
with:
  url: ${{ vars.STAGING_BACKEND_URL }}
  expected-tag: ${{ needs.changes.outputs.image-tag }}
  basic-auth: ${{ vars.STAGING_BASIC_AUTH }}        # Optional, for protected staging
```

### `_stop.yml` — Stop Compose

```yaml
# Inputs: dokploy-compose-id
# POST compose.stop — used after prod deploy to stop staging
uses: ./.github/workflows/_stop.yml
with:
  dokploy-compose-id: ${{ vars.DOKPLOY_COMPOSE_ID_STAGING_BACKEND }}
secrets: inherit
```

### `_test.yml` — Run Tests

```yaml
# Inputs: context
# checkout → corepack → setup-node 24 → yarn --immutable → yarn test:run
uses: ./.github/workflows/_test.yml
with:
  context: ./backend
```

## Orchestration: `deploy-staging.yml`

Triggers on push to `main`. Job chain uses `!failure() && !cancelled()` to allow partial deployment (only changed services deploy):

```yaml
changes → test-backend → build-backend ─┐
                                         ├→ update-env-* → deploy-* → verify-*
changes → build-frontend ───────────────┘
```

## Orchestration: `deploy-prod.yml`

Same as staging plus:
- `fetch-depth: 0` and previous tag detection for path filtering between releases
- Extra tags: `:latest` + `:${github.ref_name}` (semver)
- Stop-staging jobs after verify succeeds

## App Requirement: `/api/version` Endpoint

Your app must expose a `GET /api/version` endpoint that returns:

```json
{ "sha": "sha-abc1234" }
```

The SHA must match the `IMAGE_TAG` value set during build. Example implementation:

```typescript
// Backend (Next.js API route or Payload endpoint)
export function GET() {
  return Response.json({ sha: process.env.APP_VERSION ?? 'dev' })
}
```

## Dokploy Compose Setup

Each compose project uses `IMAGE_TAG` env var (set via `_update-env.yml`):

```yaml
services:
  backend:
    image: registry.example.com/myproject/backend:${IMAGE_TAG}
```

No `pull_policy: always` needed — each deploy uses a unique SHA-based tag.

## Required Secrets

Set in GitHub → Settings → Secrets and variables → Actions → Secrets:

| Secret | Description |
|--------|-------------|
| `REGISTRY_USERNAME` | Docker registry username |
| `REGISTRY_PASSWORD` | Docker registry password or token |
| `DOKPLOY_API_KEY` | API token from Dokploy profile settings |
| `DOKPLOY_URL` | Dokploy instance URL (no trailing slash) |

## Required Variables

Set in GitHub → Settings → Secrets and variables → Actions → Variables:

| Variable | Description |
|----------|-------------|
| `DOKPLOY_COMPOSE_ID_STAGING_{SERVICE}` | Compose ID for staging environment |
| `DOKPLOY_COMPOSE_ID_PROD_{SERVICE}` | Compose ID for production environment |
| `STAGING_{SERVICE}_URL` | Staging URL for version verification (e.g. `https://staging.example.com`) |
| `PROD_{SERVICE}_URL` | Production URL for version verification |
| `STAGING_BASIC_AUTH` | Basic auth for protected staging (optional, format: `user:pass`) |

Find Compose IDs in Dokploy dashboard URL: `https://<dokploy>/dashboard/project/.../services/compose/<composeId>`.

## Adding a New Service

1. Add path filter in both `deploy-staging.yml` and `deploy-prod.yml`:
   ```yaml
   filters: |
     newservice:
       - 'newservice/**'
   ```

2. Add job output:
   ```yaml
   outputs:
     newservice: ${{ steps.filter.outputs.newservice }}
   ```

3. Add test job (if tests exist):
   ```yaml
   test-newservice:
     needs: changes
     if: needs.changes.outputs.newservice == 'true'
     uses: ./.github/workflows/_test.yml
     with:
       context: ./newservice
   ```

4. Add build job (needs test if present, otherwise just changes):
   ```yaml
   build-newservice:
     needs: [changes, test-newservice]
     if: needs.changes.outputs.newservice == 'true'
     uses: ./.github/workflows/_build.yml
     with:
       service: newservice
       context: ./newservice
       image: registry.example.com/myproject/newservice
       tag: ${{ needs.changes.outputs.image-tag }}
     secrets: inherit
   ```

5. Add update-env job (needs ALL builds — not just its own):
   ```yaml
   update-env-newservice:
     needs: [changes, build-backend, build-frontend, build-newservice]
     if: ${{ !failure() && !cancelled() && needs.changes.outputs.newservice == 'true' }}
     uses: ./.github/workflows/_update-env.yml
     with:
       dokploy-compose-id: ${{ vars.DOKPLOY_COMPOSE_ID_STAGING_NEWSERVICE }}
       image-tag: ${{ needs.changes.outputs.image-tag }}
     secrets: inherit
   ```

6. Add deploy and verify jobs following the same pattern.

7. Add GitHub variables:
   - `DOKPLOY_COMPOSE_ID_STAGING_NEWSERVICE`
   - `DOKPLOY_COMPOSE_ID_PROD_NEWSERVICE`
   - `STAGING_NEWSERVICE_URL`
   - `PROD_NEWSERVICE_URL`

8. Create Dokploy compose project with `IMAGE_TAG` env var in the compose file.

9. Add `/api/version` endpoint to the service.

## Known Issues

### First deployment requires manual trigger
The first deployment has no previous tag to compare against. The workflow handles this by falling back to the initial commit, but all services will be deployed.

### Path filter false negatives
If a service depends on shared code outside its directory (e.g., `shared/`), add those paths to the filter:
```yaml
backend:
  - 'backend/**'
  - 'shared/**'
```

### update-env needs ALL builds
The `!failure() && !cancelled()` condition with all builds in `needs` is intentional. If one build fails, no env updates happen for any service. This prevents deploying a frontend that expects a new backend API that failed to build.
