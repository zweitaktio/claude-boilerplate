---
version: 1.8.1
applies: Always
target: rules
tags: [code-review, review, security, quality, validation, smells, comments, best-practices]
---

# Code Quality Standards

## Priority Levels
- **Critical:** Security vulnerabilities, data loss, crashes
- **High:** Logic errors, missing validation, race conditions
- **Medium:** Code smells, DRY violations, missing error handling
- **Low:** Naming, formatting, minor style issues

## Review Checklist

Run every item. Load the Convention Adherence table before starting.

1. **Security** — validate inputs at boundaries, check auth, review `core/security-checklist`
2. **Correctness** — trace logic through edge cases and error paths
3. **Performance** — check for N+1 queries, unbounded collections, memory leaks
4. **Architecture** — verify separation of concerns and dependency direction
5. **Smells & cruft** — check dead weight, complexity, type, abstraction, and stale patterns below
6. **Domain best practices** — apply frontend/backend/shared rules below
7. **Convention adherence** — match code against the domain reference table below

## Code Smells & Cruft

Don't write these in the first place — they're authoring rules, not just review flags. The Review Checklist (step 5) is the safety net for what slips through, not the primary defense.

**Dead weight:**
- Unused imports, variables, parameters, or functions
- Commented-out code blocks (delete it — git has history)
- Unreachable branches or impossible conditions
- `TODO`/`FIXME` comments that are now stale

**Complexity smells:**
- Deeply nested conditionals (>3 levels) — extract to early returns or helper functions
- Functions doing more than one thing — split by responsibility
- God components (>200 lines, multiple concerns mixed)
- Boolean parameters that change function behavior — use separate functions or options object

**Type smells (TypeScript):**
- `as` casts that suppress real type errors (vs legitimate narrowing)
- `any` leaking through function boundaries
- Overly broad types where a narrower one exists
- Missing return types on exported functions

**Abstraction smells:**
- Over-abstraction — wrapper functions that add nothing, premature generalization for one use case
- Under-abstraction — same logic duplicated across 3+ locations
- Leaky abstractions — internal implementation details exposed in public interfaces
- Wrong abstraction — when modifying requires understanding the abstraction's internals

**Stale patterns:**
- APIs or patterns from a previous major version of a dependency
- Workarounds for bugs that have been fixed upstream
- Compatibility shims for removed functionality

## Comments

Write the code to read on its own first; add a comment only where the code genuinely can't explain itself. These are authoring rules — apply them as you write, not just at review.

- **Comment the why, not the what.** Restating the mechanism (`// increment the counter`) rots and adds noise. Explain what the code can't: why this approach over the obvious one, a non-obvious constraint, an invariant callers must uphold.
- **Anchor the non-obvious to a source.** Workarounds link the issue/PR; magic values cite where they come from. A claim in a comment that nobody can verify is worse than no comment.
- **Don't restate types or narrate lines.** `// returns a string` duplicates the signature; line-by-line narration duplicates the code. Both drift out of sync with what they describe.
- **A `TODO`/`FIXME` carries an owner or issue link** — a bare one is invisible forever. (Commented-out code: delete it — see Dead weight above.)

## Domain Best Practices

**Frontend:** See `core/react-components` for React/SSR patterns (useEffect, derived state, data fetching in loaders).

**Backend:** See `core/security-checklist` for input validation. Database operations use the ORM/CMS API, never raw SQL. Error responses have consistent shape. Bulk operations bounded (pagination, limits). Every pure function (no side effects, no DB/network calls) must have a unit test — see `core/unit-testing` for conventions.

**Shared:**
- Errors handled or intentionally propagated, never silently swallowed
- Async fetch calls use AbortController for cancellation. Timers use cleanup functions. See `vendor/react-hooks` (auto-loaded) for patterns
- External service calls have error handling (not just happy path)
- Environment-specific values come from config, not hardcoded

## Convention Adherence

Load these before reviewing code that touches their domain:

| If code touches... | Reference | Look for |
|--------------------|-----------|----------|
| React components | `core/react-components` (auto-loaded) | Arrow functions, Props typing, named exports |
| Translations | `core/i18n` (auto-loaded) | Static keys, English defaults, no JSON edits |
| SSR/hydration | `core/ssr-hydration` (auto-loaded) | Client guards, no timers in render |
| Security | `core/security-checklist` (auto-loaded) | Input validation, cookie settings, rate limits |
| UI/styling | `vendor/daisyui-5`, `vendor/tailwind-4` (auto-loaded) | DaisyUI classes, v5 form patterns |
| Tailwind | `vendor/tailwind-4` (auto-loaded) | CVA patterns, twMerge usage |
| Routing/loaders | `vendor/react-router-8/` rules (auto-loaded) | Route IDs, loader types, fetcher patterns |
| i18n setup | `vendor/react-router-8-i18n/` rules (auto-loaded) | Namespace usage, language config |

## Early Bailout

Fail fast after 2-3 repeated failures. See `core/engineering-discipline` Failure Protocol for the full procedure.
