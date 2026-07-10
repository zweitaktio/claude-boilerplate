---
version: 2.0.0
vendor: VendorReactRouter8Routing
source_template: vendor/react-router-8/routing.md
applies: react-router@8
tags: [react-router, routing, routes.ts, file-based]
---

# React Router 8 explicit route config

Pitfall: Projects using explicit route config (`routes.ts`) require manual route registration — new route files are NOT auto-discovered like in file-based routing mode.

## Symptom

New route file created but page returns 404. No errors in console — the route simply doesn't exist.

## Root Cause

React Router 8 supports two routing modes:
1. **File-based routing** — routes auto-discovered from file structure (convention-based)
2. **Explicit route config** — routes declared in `routes.ts` (config-based)

When a project uses explicit config (`routes.ts`), adding a new file under `app/routes/` does nothing unless the route is also registered in `routes.ts`.

## How to Check

Look for `routes.ts` in the frontend root. If it exists and exports a route config, the project uses explicit routing.

```ts
// routes.ts — explicit config
import { type RouteConfig, route } from '@react-router/dev/routes'

export default [
  route('/', 'routes/home.tsx'),
  route('/about', 'routes/about.tsx'),
  // New routes MUST be added here
] satisfies RouteConfig
```

## Fix

Always register new routes in `routes.ts` when the project uses explicit config. Check `routes.ts` before creating any new route file.

## Prevention

Before adding a route, check if `routes.ts` exists. If it does, plan for both the route file AND the config entry.
