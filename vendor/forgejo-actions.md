---
version: 1.1.0
applies: .forgejo/workflows | .gitea/workflows
target: graph
tags: [forgejo, gitea, cicd, actions, workflows]
---

# Forgejo/Gitea Actions

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| Forgejo Actions | https://forgejo.org/docs/latest/user/actions/ | Official Forgejo docs |
| Gitea Actions | https://docs.gitea.com/usage/actions/overview | Gitea equivalent |
| Runner setup | https://forgejo.org/docs/latest/admin/actions/ | Admin/runner config |
| Compatibility | https://forgejo.org/docs/latest/user/actions/#compatibility-with-github-actions | GHA compatibility notes |
| act_runner | https://gitea.com/gitea/act_runner | Runner source |

## GitHub Actions compatibility
- Basic YAML syntax, triggers, expressions work
- `actions/checkout`, `docker/login-action`, `docker/build-push-action` work
- `workflow_call` (reusable workflows), `secrets: inherit` work

## Known incompatibilities
- `cache-from: type=gha` / `cache-to: type=gha` — use `type=registry` instead
- `dorny/paths-filter` — may fail, replace with `git diff` if needed
- Actions calling GitHub API directly will fail
- `job.permissions` and `continue-on-error` on jobs are ignored
- `hashFiles()` not supported — use `go-hashfiles` action
- Default runner image is minimal Debian, not full Ubuntu

## Registry cache pattern
```yaml
cache-from: type=registry,ref=registry.example.com/image:cache
cache-to: type=registry,ref=registry.example.com/image:cache,mode=max
```

## Runner cache
- Built-in cache server on the runner — `actions/cache@v4` works out of the box
- Cache is stored runner-side, never sent to Forgejo server
- Docker layer caching: runner containers are destroyed after jobs, so use `type=registry` or mount a persistent host volume
