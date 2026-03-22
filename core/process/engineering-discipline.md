---
version: 1.4.0
applies: Always
target: rules
priority: high
tags: [engineering, process, planning, verification, discipline, workflow]
---

# Engineering Discipline

## Task Assessment

Before touching code, understand what you're dealing with.

| Type | Approach |
|------|----------|
| **Trivial** (typo, obvious fix) | Fix directly, run checks |
| **Simple** (clear scope, single file) | Read context, implement, verify |
| **Complex** (multiple files, unclear cause) | Full assessment below |

**For complex tasks:**
1. Identify all affected files and modules
2. Check who consumes what you're changing — `find_referencing_symbols` at module boundaries
3. Determine if changes cross package/workspace boundaries
4. Decompose into incremental, independently verifiable steps before starting
5. Check existing patterns in the codebase before creating anything new

## Planning

**Default to plan mode.** Use it for anything beyond trivial fixes — new features, multi-file changes, unclear scope, or any task where you'd otherwise start coding and discover problems mid-way.

Before finalizing a plan, check for known pitfalls:
1. `search_nodes("domain: <relevant domain>")` — load vendor docs for libraries the task touches
2. `search_nodes("Pitfall")` or `search_nodes("bug_resolution")` — find recorded issues in this project
3. Read any returned observations for gotchas, version-specific quirks, or past failures that apply

Incorporate findings into the plan — flag risks, reference specific pitfalls, and choose approaches that avoid known issues. A plan that repeats a documented mistake is worse than no plan.

## Verification Discipline

**Never trust assumptions about library APIs.** Follow the library doc lookup in `core/process/mcp-tools` before writing library code — KG first, then web search + Context7 for the specific installed version.

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

*Required:* Find all consumers with `find_referencing_symbols`. Update all call sites. Consider migration path.

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
5. **Rollback readiness** — before complex changes, ensure you can get back to a working state

## Decision-Making

**The user makes decisions, not the agent.**

When multiple approaches, trade-offs, or design choices exist — present the options and let the user choose. Don't pick for them, even if one option seems obvious. The user has context you don't.

- Present options with concrete trade-offs (not abstract pros/cons)
- Include your recommendation with reasoning, but frame it as a suggestion
- Wait for the user's choice before implementing

**Uncertain about implementation:**
- Verify with documentation (Context7) or source code
- Test with the smallest possible change first
- Ask the user — don't guess at requirements

**Ambiguous requirements:**
- Ask for clarification before implementing
- Never proceed on assumptions when the user is available to answer

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
