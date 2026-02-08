---
version: 1.1.0
applies: dokploy | .github/workflows/*dokploy* | .github/workflows/*deploy*
target: graph
tags: [dokploy, cicd, deployment, github-actions, docker, monorepo]
---

# Dokploy Monorepo CI/CD

Reusable GitHub Actions workflow pattern for monorepo deployments with path-based filtering and Dokploy integration.

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| Dokploy docs | https://docs.dokploy.com | Official docs |
| Dokploy GitHub | https://github.com/Dokploy/dokploy | Source, issues |
| Deploy action | https://github.com/benbristow/dokploy-deploy-action | `benbristow/dokploy-deploy-action` |
| paths-filter | https://github.com/dorny/paths-filter | `dorny/paths-filter` for change detection |
| Docker build-push | https://github.com/docker/build-push-action | `docker/build-push-action` |
| GHA reusable workflows | https://docs.github.com/en/actions/using-workflows/reusing-workflows | `workflow_call` pattern |

## Overview

This pattern provides:
- **Path-based filtering** — only build/deploy services with actual changes
- **Reusable workflow** — single `_build-deploy.yml` called by environment-specific workflows
- **Staging on push** — deploy to staging when pushing to `main`
- **Production on tag** — deploy to production when pushing semver tags (e.g. `1.2.3`)
- **Dokploy integration** — trigger compose deployments via Dokploy API

## File Structure

```
.github/
├── README.md                 # CI/CD documentation
└── workflows/
    ├── _build-deploy.yml     # Reusable workflow (prefixed with _)
    ├── deploy-staging.yml    # Staging deployment trigger
    └── deploy-prod.yml       # Production deployment trigger
```

## Reusable Workflow: `_build-deploy.yml`

```yaml
name: Build & Deploy

on:
  workflow_call:
    inputs:
      service:
        required: true
        type: string
      context:
        required: true
        type: string
      image:
        required: true
        type: string
      tag:
        required: true
        type: string
      dokploy-compose-id:
        required: true
        type: string

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: registry.example.com
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - uses: docker/build-push-action@v6
        with:
          context: ${{ inputs.context }}
          push: true
          tags: ${{ inputs.image }}:${{ inputs.tag }}
          cache-from: type=gha,scope=${{ inputs.service }}
          cache-to: type=gha,mode=max,scope=${{ inputs.service }}

      - name: Deploy via Dokploy
        uses: benbristow/dokploy-deploy-action@0.2.2
        with:
          api_token: ${{ secrets.DOKPLOY_API_KEY }}
          application_id: ${{ inputs.dokploy-compose-id }}
          dokploy_url: ${{ secrets.DOKPLOY_URL }}
          service_type: compose
```

## Staging Workflow: `deploy-staging.yml`

Triggers on push to `main`, only builds services with changes:

```yaml
name: Deploy Staging

on:
  push:
    branches: [main]

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
      landingpage: ${{ steps.filter.outputs.landingpage }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'backend/**'
            frontend:
              - 'frontend/**'
            landingpage:
              - 'landingpage/**'

  backend:
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    uses: ./.github/workflows/_build-deploy.yml
    with:
      service: backend
      context: ./backend
      image: registry.example.com/myproject/backend
      tag: staging
      dokploy-compose-id: ${{ vars.DOKPLOY_COMPOSE_ID_STAGING_BACKEND }}
    secrets: inherit

  frontend:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    uses: ./.github/workflows/_build-deploy.yml
    with:
      service: frontend
      context: ./frontend
      image: registry.example.com/myproject/frontend
      tag: staging
      dokploy-compose-id: ${{ vars.DOKPLOY_COMPOSE_ID_STAGING_FRONTEND }}
    secrets: inherit

  # Add more services as needed...
```

## Production Workflow: `deploy-prod.yml`

Triggers on semver tags, compares against previous tag:

```yaml
name: Deploy Prod

on:
  push:
    tags: ['[0-9]*.[0-9]*.[0-9]*']

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
      landingpage: ${{ steps.filter.outputs.landingpage }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Get previous tag
        id: prev_tag
        run: |
          PREV=$(git tag --sort=-creatordate | grep -E '^[0-9]+\.[0-9]+\.[0-9]+' | sed -n '2p')
          echo "tag=${PREV:-$(git rev-list --max-parents=0 HEAD)}" >> $GITHUB_OUTPUT
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          base: ${{ steps.prev_tag.outputs.tag }}
          filters: |
            backend:
              - 'backend/**'
            frontend:
              - 'frontend/**'
            landingpage:
              - 'landingpage/**'

  backend:
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    uses: ./.github/workflows/_build-deploy.yml
    with:
      service: backend
      context: ./backend
      image: registry.example.com/myproject/backend
      tag: prod
      dokploy-compose-id: ${{ vars.DOKPLOY_COMPOSE_ID_PROD_BACKEND }}
    secrets: inherit

  frontend:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    uses: ./.github/workflows/_build-deploy.yml
    with:
      service: frontend
      context: ./frontend
      image: registry.example.com/myproject/frontend
      tag: prod
      dokploy-compose-id: ${{ vars.DOKPLOY_COMPOSE_ID_PROD_FRONTEND }}
    secrets: inherit

  # Add more services as needed...
```

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

Find Compose IDs in Dokploy dashboard URL: `https://<dokploy>/dashboard/project/.../services/compose/<composeId>`.

## Dokploy Compose Setup

Each compose project must use fixed alias tags with `pull_policy: always`:

```yaml
services:
  backend:
    image: registry.example.com/myproject/backend:staging  # or :prod
    pull_policy: always
```

This ensures Dokploy always pulls the freshly pushed image on deploy.

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

3. Add deployment job:
   ```yaml
   newservice:
     needs: changes
     if: needs.changes.outputs.newservice == 'true'
     uses: ./.github/workflows/_build-deploy.yml
     with:
       service: newservice
       context: ./newservice
       image: registry.example.com/myproject/newservice
       tag: staging  # or prod
       dokploy-compose-id: ${{ vars.DOKPLOY_COMPOSE_ID_STAGING_NEWSERVICE }}
     secrets: inherit
   ```

4. Add GitHub variables for compose IDs:
   - `DOKPLOY_COMPOSE_ID_STAGING_NEWSERVICE`
   - `DOKPLOY_COMPOSE_ID_PROD_NEWSERVICE`

5. Create Dokploy compose project with matching image tag

## Forgejo/Gitea Compatibility

When using with Forgejo/Gitea Actions instead of GitHub Actions:

- `dorny/paths-filter` may fail — replace with `git diff` if needed:
  ```yaml
  - name: Check changes
    id: filter
    run: |
      CHANGED=$(git diff --name-only ${{ github.event.before }} ${{ github.sha }} | grep -q '^backend/' && echo 'true' || echo 'false')
      echo "backend=$CHANGED" >> $GITHUB_OUTPUT
  ```

- `cache-from: type=gha` not supported — use `type=registry`:
  ```yaml
  cache-from: type=registry,ref=registry.example.com/myproject/backend:cache
  cache-to: type=registry,ref=registry.example.com/myproject/backend:cache,mode=max
  ```

See `vendor/forgejo-actions` memory for full compatibility notes.

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
