---
version: 2.1.1
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

## Stamp the page once it lands

`backport: true` means *this is generalizable*. It does not mean *this still needs carrying* — and
nothing clears it, so without a second field every page ever backported re-proposes on every scan and
the candidate list stops being a work list.

When a page's content lands in a skill template, add the skill commit that carried it:

```yaml
---
title: A Payload find() with no limit silently returns only 10 docs
backport: true
backported: cda146e      # ← the skill sha this landed in
---
```

The scan then reads as "flagged and not yet carried":

```bash
grep -rl "backport: true" .claude/rules/project | xargs grep -L "^backported:"
```

**Stamp in the same pass that lands the content.** A page stamped without its content upstream is
worse than an unstamped one — the next scan skips it silently, and the finding is lost rather than
merely repeated. If only part of a page generalized, stamp it and say in the body which part stayed
project-specific.

## What happens downstream

- `/webstack update` scans the project pages for `backport: true` without `backported:`. It then
  proposes to add them to the skill templates
- `/webstack maintenance` audits the wiki for staleness, orphans and collisions. It also surfaces the
  backport candidates
- An approved backport goes into `~/.claude/skills/webstack/vendor/` or a `core/` template, with a
  version bump
- Subsequent `/webstack update` on other projects picks up the change
