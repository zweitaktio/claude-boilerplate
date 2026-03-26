---
version: 1.2.0
applies: Always
target: rules
tags: [backport, knowledge-graph, vendor, maintenance]
paths:
  - ".memory/**"
  - ".claude/**"
  - "CLAUDE.md"
---

# Backporting to the Webstack Skill

When you record a finding in the Knowledge Graph, decide whether it's **project-specific** or **generalizable**. Generalizable findings belong in the boilerplate skill so all projects benefit — `/webstack update` and `/webstack maintenance` scan for these.

## Mark generalizable findings for backport

Add a `"Backport: <reason>"` observation alongside the finding itself. This is the tag that update/maintenance scans detect.

```
# Generalizable — library quirk, affects any project using this library
create_entities:
  name: ClientLoaderSSRBug, type: bug_resolution
  "Pitfall: clientLoader doesn't run on initial SSR — only on client navigations"
  "Backport: library behavior, not project-specific"
create_relations: ClientLoaderSSRBug -> depends_on -> VendorReactRouter7Routing

# Generalizable — reusable pattern
create_entities:
  name: FormResetAfterSubmit, type: convention
  "Pattern: call form.reset() in the action's redirect, not in the component"
  "Backport: applies to any Conform + RR7 project"

# Project-specific — do NOT mark for backport
create_entities:
  name: SyncEndpointHeader, type: bug_resolution
  "Pitfall: our custom /api/sync endpoint requires X-Org-Id header"
  (no Backport tag — this is specific to our API wrapper)
```

## Decision rule: backport or not?

If the finding applies to **any project using this library version or framework combination**, mark it for backport. If it depends on this project's domain model, config, or business logic, do not tag.

| Backport (library/version scope) | No tag (project scope) |
|----------------------------------|------------------------|
| Library bug or undocumented behavior | Business logic bug |
| Version upgrade gotcha (API changed, config format) | Project-specific config values |
| Pattern that works across projects (form handling, auth flow) | Pattern tied to project's domain model |
| GitHub issue confirming a framework limitation | Environment/deployment issue unique to one setup |
| Security finding in a dependency | Security finding in project code |

## What happens downstream

- `/webstack update` step 14 scans for `Backport:` observations → proposes adding them to skill templates
- `/webstack maintenance` step 4c finds orphan entities and checks for backport tags → proposes relating them to vendor entities
- Approved backports get added to `~/.claude/skills/webstack/vendor/` templates with a version bump
- Subsequent `/webstack update` on other projects picks up the change
