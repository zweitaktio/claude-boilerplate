---
version: 2.5.1
applies: Always
target: rules
priority: high
tags: [engineering, process, planning, verification, discipline, workflow]
---

# Engineering Discipline

## Library Doc Lookup — unconditional

**CRITICAL:** If the task touches library code, run the 3-step lookup in `core/mcp-tools` **before writing any code**. Every task — trivial, simple, or complex. No exceptions.

## Domain Pattern Lookup — before implementing features

Before implementing a feature, identify the business domain it belongs to (e.g., e-commerce, authentication, content management, search, billing, notifications). Established domains have implementation patterns refined across the industry — use them instead of inventing new approaches.

1. **Identify the domain** — what business area does this feature serve?
2. **Research established patterns** — Context7 + web search for how this is conventionally built in the domain. Search for `"<domain> <feature> implementation pattern"`, not just the library API.
3. **IMPORTANT: Follow the standard approach** — use the proven pattern as your architecture. Adapt it to the project's libraries, but don't redesign the flow itself.

```
# Wrong: invent a checkout flow from scratch
# Single-page form that charges on submit, no intermediate validation

# Right: follow the established e-commerce checkout pattern
# Multi-step → validate each step → create payment intent → confirm → capture
# This is standard across Stripe, Shopify, and the broader ecosystem for good reason
```

This applies to any domain with established conventions — cart and inventory management, OAuth/OIDC flows, RBAC, publishing workflows, faceted search, webhook retry with idempotency, rate limiting, pagination strategies, and so on.

When uncertain whether a standard pattern exists: search first. If you find the same approach described across multiple sources, it's a standard — follow it.

## Task Assessment

Before touching code, classify the task using the table below.

| Type | Criteria | Approach |
|------|----------|----------|
| **Trivial** | Typo, obvious fix, no library code | Fix directly, run checks |
| **Simple** | Clear scope, single file | Read context, implement, verify |
| **Complex** | >3 files, changes exports, unknown root cause, or crosses workspace boundaries | Full assessment below |

A task is **complex** when any of these are true: it touches more than 3 files, changes an exported interface, has an unknown root cause, or crosses package/workspace boundaries. When in doubt, treat it as complex.

**For complex tasks:**
1. Identify all affected files and modules
2. Check who consumes what you're changing — `find_referencing_symbols` at module boundaries
3. Determine if changes cross package/workspace boundaries
4. Decompose into incremental, independently verifiable steps before starting
5. Check existing patterns in the codebase before creating anything new

## Planning

**IMPORTANT: Default to plan mode.** Use it for anything beyond trivial fixes — new features, multi-file changes, unclear scope, or any task where you'd otherwise start coding and discover problems mid-way.

**CRITICAL:** Before finalizing a plan, query the Knowledge Graph for pitfalls and past decisions. This is separate from the library doc lookup (which runs before writing code) — KG queries here catch architectural constraints early:
1. `search_nodes("Pitfall")` or `search_nodes("bug_resolution")` — find recorded issues in this project
2. `search_nodes("architecture_decision")` — past decisions that constrain the approach
3. Read any returned observations for gotchas, version-specific quirks, or past failures that apply

Incorporate findings into the plan — flag risks, reference specific pitfalls, and choose approaches that avoid known issues. A plan that repeats a documented mistake is worse than no plan.

### Self-review before presenting

**IMPORTANT:** Before presenting a plan, challenge it — the user's review should be a strategic alignment check, not QA:

- Does this actually address what the user asked, or did I drift?
- What edge cases or failure modes exist?
- Does it conflict with existing patterns in the codebase?
- What would a reviewer push back on?
- Are error paths covered for every external call (API, DB, file I/O)?
- Are breaking changes flagged with migration paths?
- How will the implementation be verified end-to-end?

Fix gaps before presenting.

## Verification Discipline

Read error messages literally — don't pattern-match to what you expect.

Read error messages literally — don't pattern-match to what you expect.

```
# Wrong: assume DaisyUI 5 still has form-control
<div className="form-control">  // removed in DaisyUI 5

# Right: check package.json first, see daisyui@5.x, look up docs
<fieldset className="fieldset">  // DaisyUI 5 replacement
```

## Change Classification

Before implementing, classify the change to determine required safeguards.

**Breaking** — changes the contract consumers depend on:
- Renamed or removed exports
- Changed function signatures (required params added, return type changed)
- Database schema changes (column rename, type change, removal)
- API endpoint changes (path, method, request/response shape)
- Removed CSS classes or changed component prop interfaces

**CRITICAL:** Find all consumers with `find_referencing_symbols`. Update all call sites. Consider migration path.

**Additive** — extends without breaking existing behavior:
- New exports, components, routes, endpoints
- New optional parameters with defaults
- New database columns with defaults or nullable

*Safe* to implement directly. Verify with checks.

**Refactor** — same external behavior, different internals:
- Restructuring within a module
- Extracting helpers, renaming locals, reorganizing files
- Performance improvements with identical output

*Required:* Verify tests pass. Confirm no exported interface changes. Use `find_referencing_symbols` if uncertain.

**How to decide:**
- Is the symbol exported from a module boundary? → Potentially breaking
- Does anyone import or call it? → Check with `find_referencing_symbols`
- Does only the current file use it? → Safe refactor
- Does the database schema change? → Always treat as breaking

## Implementation Process

1. **Track progress with task lists** — create tasks for any work with 2+ steps. Mark `in_progress` before starting, `completed` when done. This gives the user visibility into what's happening and what's left.
2. **One logical change at a time** — don't bundle unrelated changes
3. **Verify between steps** — `yarn check` runs automatically via hook after each Edit/Write; read its output before continuing
4. **Single-variable changes** — change one thing, check. Changing three things and having it break means you don't know which one caused it.
5. **Rollback readiness** — before complex changes, commit the current working state:
   ```bash
   git add -A && git commit -m "checkpoint: before refactoring auth middleware"
   ```
   If the change fails, `git diff HEAD~1` shows exactly what broke.

## Decision-Making

**The user makes decisions, not the agent.**

When multiple approaches, trade-offs, or design choices exist — present the options and let the user choose. Don't pick for them, even if one option seems obvious. The user has context you don't.

- Present options with concrete trade-offs (not abstract pros/cons)
- Include your recommendation with reasoning, but frame it as a suggestion
- Wait for the user's choice before implementing

```
# Bad — abstract pros/cons
"Option A is more maintainable. Option B is more performant."

# Good — concrete trade-offs
"Option A: inline the query — 3 fewer files, but duplicates the filter logic in 2 routes.
 Option B: shared loader util — DRY, but adds a module boundary (breaking change if the signature changes later).
 I'd suggest A since both routes are in the same file today."
```

**IMPORTANT: Ask, don't assume.** Assumptions are unreliable — most turn out wrong and cost more to fix than asking would have cost upfront. When any of these are true, stop and ask the user before proceeding:

- The requirement can be interpreted more than one way
- You're about to pick an approach because it "seems right" without evidence
- You're filling in details the user didn't specify
- The implementation has trade-offs the user should know about
- You're unsure whether a behavior is intended or a bug

This applies to subagents too — when delegating, include "ask the parent agent if requirements are unclear" in the task prompt. Don't let subagents guess independently.

**When you can proceed without asking:**
- The codebase has an established pattern and you're following it
- Documentation (Context7, vendor docs) confirms the approach
- The task is a direct, unambiguous instruction ("rename X to Y")

## Failure Protocol

After 2-3 failed attempts at the same approach:

1. **Stop** — don't dig deeper into a failing approach
2. **Document** — what was tried, what failed, error messages
3. **Reassess** — is the diagnosis correct? Is there a simpler explanation?
4. **Pivot** — try a fundamentally different approach, or ask for help

### Anti-Patterns

- **Trial-and-error spirals** — random changes hoping something works.
  ```
  # Wrong: TypeError in loader, try adding ?. everywhere
  const data = await response?.json?.()  // didn't read the actual error

  # Right: read the error — "Cannot read properties of undefined (reading 'json')"
  # response is undefined → the fetch call is wrong, not the json() call
  ```
- **Premature implementation** — coding before understanding the problem. Read time should be proportional to complexity.
- **Tunnel vision** — fixating on one area when the problem is elsewhere. If your hypothesis doesn't explain the error, it's wrong — widen the search.
- **Scope creep during fixes** — "while I'm here, let me also..." Fix the issue, create a separate task for improvements.
