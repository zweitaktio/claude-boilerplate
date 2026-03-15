---
version: 1.0.0
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
add_observations to VendorReactRouter7Routing:
  "Pitfall: clientLoader doesn't run on initial SSR — only on client navigations"
  "Backport: library behavior, not project-specific"

# Generalizable — reusable pattern
create_entities:
  name: FormResetAfterSubmit, type: convention
  "Pattern: call form.reset() in the action's redirect, not in the component"
  "Backport: applies to any Conform + RR7 project"

# Project-specific — do NOT mark for backport
add_observations to VendorPayloadCms3:
  "Pitfall: our custom /api/sync endpoint requires X-Org-Id header"
  (no Backport tag — this is specific to our API wrapper)
```

## What is generalizable

| Generalizable (mark for backport) | Project-specific (no tag) |
|-----------------------------------|---------------------------|
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
