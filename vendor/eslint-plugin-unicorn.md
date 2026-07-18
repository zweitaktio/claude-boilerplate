---
version: 1.0.0
applies: eslint-plugin-unicorn
target: rules
domain: tooling
paths:
  - "**/eslint.config.js"
  - "**/eslint.config.mjs"
  - "**/eslint.config.ts"
  - "**/eslint.config.cjs"
tags: [eslint, unicorn, linting, config, major-upgrade, recommended]
---

# eslint-plugin-unicorn

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| GitHub | https://github.com/sindresorhus/eslint-plugin-unicorn | Source, per-rule docs, changelog |
| npm | https://www.npmjs.com/package/eslint-plugin-unicorn | Versions, peer range |

## Major-version upgrades: curate `unicorn/recommended`, don't mechanically fix

Each major bump expands `unicorn/configs/recommended` with new rules — a single bump can add ~25 rules and surface hundreds of errors across the codebase. **Extend the config's disable block with reasoned comments; do not mechanically "fix" every new error.** Many newly-added rules are opinionated or unsafe for React / library-heavy code:

| Rule | Why disable or warn |
|------|---------------------|
| `unicorn/consistent-boolean-name` | Wants to rename controlled props like `open` / `checked` — breaks UI-library contracts (Base UI, Radix, etc.) |
| `unicorn/no-non-function-verb-prefix` | Flags legitimate object names like `deleteFetcher` (from `useFetcher()`) and state setters |
| `unicorn/name-replacements`, `unicorn/prevent-abbreviations` | Abbreviation-policing — noisy and rename-heavy, rarely worth the churn |
| `unicorn/prefer-await` | Set to `warn`, not error — deliberate fire-and-forget `.catch()` (analytics, side effects) must not be forced to `await`, which would block the UI on a non-critical call |

**Pattern:** keep a single disable block in `eslint.config.*` with a one-line comment per rule explaining *why* it's off. Set rules you intend to adopt gradually to `'warn'` rather than force-fixing them. Prefer this over a bulk `--fix`, which fights the config's own curated philosophy and can rename library-contract props, causing runtime regressions.

**Peer note:** newer unicorn majors track ESLint majors tightly (e.g. unicorn 72 requires ESLint `>=10.4`). Check the plugin's `peerDependencies.eslint` against your installed ESLint version before bumping.
