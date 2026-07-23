---
version: 2.0.0
applies: Always
target: rules
tags: [backport, knowledge-base, vendor, maintenance]
paths:
  - ".claude/rules/project/**"
  - ".claude/docs/**"
  - "CLAUDE.md"
---

# Backporting to the Webstack Skill

When you record a knowledge page, decide whether it's **project-specific** or **generalizable**.
Generalizable findings belong in the boilerplate skill so all projects benefit — `/webstack update`
and `/webstack maintenance` scan for these.

## Mark generalizable findings for backport

Add `backport: true` to the page's frontmatter. This is the flag that update/maintenance scans detect.

```yaml
# Generalizable — library quirk, affects any project using this library
---
schema: 1
title: clientLoader doesn't run on initial SSR — only on client navigations
type: pitfall
status: active
paths: ["**/routes/**"]
tags: [react-router, ssr]
links: [vendor/react-router-8/routing]
backport: true          # ← library behavior, not project-specific
---
```

```yaml
# Project-specific — no backport flag
---
schema: 1
title: our /api/sync endpoint requires an X-Org-Id header
type: pitfall
status: active
paths: ["**/services/sync/**"]
tags: [sync, api]
# no backport: — specific to our API wrapper
---
```

## Decision rule: backport or not?

If the finding applies to **any project using this library version or framework combination**, set
`backport: true`. If it depends on this project's domain model, config, or business logic, do not.

| Backport (library/version scope) | No flag (project scope) |
|----------------------------------|------------------------|
| Library bug or undocumented behavior | Business logic bug |
| Version upgrade gotcha (API changed, config format) | Project-specific config values |
| Pattern that works across projects (form handling, auth flow) | Pattern tied to project's domain model |
| GitHub issue confirming a framework limitation | Environment/deployment issue unique to one setup |
| Security finding in a dependency | Security finding in project code |

## What happens downstream

- `/webstack update` scans project pages for `backport: true` → proposes adding them to skill templates
- `/webstack maintenance` audits the wiki (staleness, orphans, collisions) and surfaces backport candidates
- Approved backports get added to `~/.claude/skills/webstack/vendor/` or `core/` templates with a version bump
- Subsequent `/webstack update` on other projects picks up the change
