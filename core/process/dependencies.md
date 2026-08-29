---
version: 1.0.1
applies: Always
target: rules
paths:
  - "**/package.json"
  - "**/tsconfig*.json"
  - "**/eslint.config.*"
  - "**/.eslintrc*"
  - "**/.fallowrc*"
  - "**/yarn.lock"
  - "**/package-lock.json"
  - "**/pnpm-lock.yaml"
tags: [dependencies, types, eslint, typescript, upgrades, lockfile]
---

# Dependencies, Types and Config Changes

Every rule here shares a failure mode: the change looks correct, the type checker agrees, and it
breaks somewhere the type checker never looks.

## Declare what you use — transitive resolution is not a contract

**Any package whose source references `process`, `node:*` imports, `Buffer` or `__dirname` owns a
direct `@types/node` devDependency.** It commonly resolves transitively instead, hoisted in via some
other `@types/*` package — until an unrelated removal or an upgrade changes the hoist graph and the
Node globals lose their declarations:

```
error TS2591: Cannot find name 'process'. Do you need to install type definitions for node?
```

The files that break are ones nobody touched. TypeScript 6 sharpens this: `types` now defaults to
`[]` instead of `["*"]`, so there is no auto-inclusion to fall back on (see `core/tooling` § TypeScript 6).

## A `@types/*` package should have no runtime dependencies

Several older `@types/*` packages are deprecated stubs for libraries that now ship their own types —
and some of them **depend on the runtime package**. A types-only devDependency then drags a whole
native binary chain in, and you end up with two builds of the same native library loaded in one
process:

```
objc: Class … is implemented in both …/libvips-cpp.42.dylib and …/libvips-cpp.8.17.3.dylib
```

Before adding any `@types/*`, check whether the library already ships `"types"` in its manifest. In
any native-dependency conflict, map every chain that pulls the package in — a transitive consumer
(a build plugin, say) can win the hoist slot and push the declared version into a nested
`node_modules`. Pin with `resolutions` so one copy is shared.

## Unused-dependency tools reason over source imports only

Before deleting anything a dead-code tool flags, grep installed manifests for a peer edge on that
name, then run a real **build** — `tsc` never sees a dependency that nothing imports from source.
Three edges these tools structurally cannot follow:

- **Optional peer dependencies.** The only importer lives inside `node_modules`, so neither the
  import graph nor a repo grep sees it. Removing one passes `tsc`, then fails the bundler with
  `[MISSING_EXPORT] … is not exported by "__vite-optional-peer-dep:…"`.
- **Dependencies named only as strings in config** — a babel plugin or preset referenced by name in
  `vite.config.ts`.
- **Meta-packages** that transitively supply undeclared imports.

Keep them declared and list them in the tool's ignore list, with a comment saying which mechanism
hides them.

## Verify a library upgrade at runtime, not just against the type checker

A bump that moves a package's **runtime** across a major without moving its `@types/*` leaves `tsc`
validating an API that no longer exists. The classic shape is a package going ESM-only and dropping
its default export while the stale types still declare one:

```
The requested module 'archiver' does not provide an export named 'default'
```

`tsc` passes; the process dies at startup. This only surfaces in code executed as raw Node ESM, never
in bundled code. A `node` probe that imports the package and checks for the export it expects catches
it in seconds — do that as part of any major bump, and bump the `@types/*` in the same commit.

## Changing an ESLint config rewrites the whole project on the next edit

If `check` is `eslint . --fix && …` — note the `.`, the whole project, not the files you touched —
and a PostToolUse hook runs `check` after every edit, then the **first edit after a config change
applies every newly-enabled autofixable rule across the entire codebase, in one unattended pass.**
Adding a recommended preset has produced 57 modified files in a single pass: identifier renames, a
dropped `.toString()`, changed `split('T')[0]` to `split('T', 1)[0]`, and reordered the unions.

- **Nobody owns the result.** On a shared branch every session honestly disclaims the files, because
  none of them typed a line of it and any of them could have triggered it. Suspect the toolchain
  before a person (see `core/multi-agent`).
- **The rules responsible may already be `'off'`** — a config under active iteration disables them
  after the damage. Check the *resolved* state, not the first screen of the file, and test against a
  **real in-project path** so `parserOptions.project` resolves. A synthetic `--stdin-filename` bails
  with a parse error and reports "no fix" — a false negative that looks like proof:
  ```bash
  npx eslint --print-config src/some/real/file.ts | jq '.rules["<rule>"]'
  npx eslint src/some/real/file.ts --fix-dry-run --format json | jq '.[0].output != null'
  ```
- **Cleaning up is per-file, never bulk.** By the time it is noticed the autofix is interleaved with
  real uncommitted work in the same files; `git checkout -- <dir>` destroys it, and no classifier can
  separate "autofix" from "human edit" after the fact — both are just diff lines.

**Land a config change and its fallout as one reviewed commit, on a quiet tree, and tell the other
sessions before you start.**

## Don't wrap a natively-flat ESLint config in `FlatCompat`

A config package that already ships flat-config exports throws `TypeError: Converting circular
structure to JSON` from `@eslint/eslintrc/config-validator` when extended through `FlatCompat` — the
wrapper creates a plugin reference cycle `JSON.stringify` cannot serialize. Import the flat config
directly and spread it, then drop the `FlatCompat`, `@eslint/eslintrc` and `@eslint/js` imports
entirely; they exist only to bridge the legacy format.

```js
import coreWebVitals from 'eslint-config-next/core-web-vitals'
export default [...coreWebVitals /* … */]
```

## `consistent-type-imports` rewrites a fresh import between edits

If the **first** usage of a newly added import is type-only (`type X = ReturnType<typeof getFoo>`),
the `@typescript-eslint/consistent-type-imports` autofix rewrites it to `import type { getFoo }`. A
later edit in the same batch that adds the value usage then fails:

```
TS1361: 'getFoo' cannot be used as a value because it was imported using 'import type'
```

**Introduce the value usage in the same edit as the import.** This is an edit-ordering hazard, not a
code defect — the identical final file written in one pass is fine.
