---
version: 1.0.1
applies: tslog
target: rules
domain: tooling
paths:
  - "**/*.ts"
  - "**/*.tsx"
tags: [tslog, logging, typescript, migration, overloads, build]
---

# tslog

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| GitHub | https://github.com/fullstack-build/tslog | Source, issues, changelog |
| npm | https://www.npmjs.com/package/tslog | Versions, changelog |

## Known Issues

### v4 → v5: logger methods reject a bare `unknown` first argument (TS2769)

tslog v5 tightened the overloads on `logger.error` / `warn` / `info` / etc. to two shapes:

- `(fields: object, message?: string, ...args: unknown[])`
- `(message: string, ...args: unknown[])`

A caught error typed `unknown` passed as the **first** argument satisfies neither overload, so `logger.error(err)` fails type-checking with `TS2769: No overload matches this call`.

```typescript
// ❌ v5 — bare unknown first arg, TS2769
try { /* ... */ } catch (err) { logger.error(err) }

// ✅ v5 — string message first, error as a trailing arg
try { /* ... */ } catch (err) { logger.error('failed to X', err) }
```

**Detection gap:** the Vitest unit tests pass, and the runtime passes. Only `tsc` flags the problem,
through `yarn typecheck` or the production build's `tsc --build`. ESLint does not gate it.

After a tslog major bump, run `yarn typecheck` or a full build across **every** workspace. Never run
the test suite alone. This surfaces the errors before they reach a Docker build.
