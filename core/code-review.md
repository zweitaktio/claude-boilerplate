---
version: 1.2.1
applies: Always
target: rules
tags: [code-review, review, security, quality, validation, smells, best-practices]
---

# Code Review Standards

## Priority Levels
- **Critical:** Security vulnerabilities, data loss, crashes
- **High:** Logic errors, missing validation, race conditions
- **Medium:** Code smells, DRY violations, missing error handling
- **Low:** Naming, formatting, minor style issues

## Review Checklist

1. **Security** — OWASP top 10, input validation, auth
2. **Correctness** — logic, edge cases, error paths
3. **Performance** — N+1 queries, unbounded collections, memory leaks
4. **Architecture** — separation of concerns, dependency direction
5. **Smells & cruft** — see below
6. **Domain best practices** — see below
7. **Convention adherence** — see below

## Code Smells & Cruft

Flag these during every review:

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

## Domain Best Practices

When reviewing code, identify the domain and verify against its known best practices. Use Context7 and Knowledge Graph vendor docs to confirm current patterns.

**Frontend (React/SSR):**
- Derived state computed in render, not via `useEffect` + `setState`
- Data fetching in loaders, not `useEffect`
- Keys on list items are stable identifiers, not array indices
- No prop drilling past 2 levels — use context or composition
- Side effects only in `useEffect` or event handlers, never in render
- Memoization (`useMemo`/`useCallback`) only where measured performance need exists

**Backend (API/CMS):**
- Input validated at system boundaries, not trusted internally
- Database operations use the ORM/CMS API, never raw SQL
- Error responses have consistent shape
- Sensitive data excluded from API responses
- Bulk operations bounded (pagination, limits)

**Shared:**
- Errors handled or intentionally propagated, never silently swallowed
- Async operations have timeout or cancellation strategy
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
| UI/styling | KG `search_nodes("domain: styling")` | DaisyUI classes, v5 form patterns |
| Tailwind | KG `search_nodes("domain: styling")` | CVA patterns, twMerge usage |
| Routing/loaders | KG `search_nodes("domain: routing")` | Route IDs, loader types, fetcher patterns |
| i18n setup | KG `search_nodes("domain: i18n")` | Namespace usage, language config |

## Early Bailout

Fail fast after 2-3 repeated failures. See `core/engineering-discipline` Failure Protocol for the full procedure.
