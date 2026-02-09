# CI/CD Pipeline

Builds Docker images on GitHub Actions and deploys via Dokploy.

## Workflows

| Workflow | Trigger | Behavior |
|----------|---------|----------|
| `deploy-staging.yml` | Push to `main` | Builds only changed services, pushes `:staging` tag, deploys to staging |
| `deploy-prod.yml` | Push semver tag (e.g. `1.2.3`) | Builds only changed services (vs previous tag), pushes `:prod` tag, deploys to production |
| `_build-deploy.yml` | Reusable (called by above) | Builds image, pushes to registry, triggers Dokploy compose deploy |

Path filtering ensures only services with actual changes are built and deployed.

## Required Secrets

Set in GitHub -> Settings -> Secrets and variables -> Actions -> Secrets.

| Secret | Description |
|--------|-------------|
| `REGISTRY_USERNAME` | Docker registry username |
| `REGISTRY_PASSWORD` | Docker registry password or token |
| `DOKPLOY_API_KEY` | API token from Dokploy profile settings |
| `DOKPLOY_URL` | Dokploy instance URL (no trailing slash) |

## Required Variables

Set in GitHub -> Settings -> Secrets and variables -> Actions -> Variables.

| Variable | Description |
|----------|-------------|
| `DOKPLOY_COMPOSE_ID_STAGING_BACKEND` | Compose ID for staging backend |
| `DOKPLOY_COMPOSE_ID_STAGING_FRONTEND` | Compose ID for staging frontend |
| `DOKPLOY_COMPOSE_ID_PROD_BACKEND` | Compose ID for production backend |
| `DOKPLOY_COMPOSE_ID_PROD_FRONTEND` | Compose ID for production frontend |

Find Compose IDs in the Dokploy dashboard URL: `https://<dokploy>/dashboard/project/.../services/compose/<composeId>`.

## Dokploy Compose Setup

Each compose project must use fixed alias tags with `pull_policy: always`:

```yaml
services:
  backend:
    image: registry.example.com/myproject/backend:staging # or :prod
    pull_policy: always

  frontend:
    image: registry.example.com/myproject/frontend:staging # or :prod
    pull_policy: always
```

This ensures Dokploy always pulls the freshly pushed image on deploy.
