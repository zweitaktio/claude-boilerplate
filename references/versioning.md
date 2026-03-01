# Template Versioning

## Frontmatter Schema

Each template file has frontmatter:

```yaml
---
version: 1.0.0
applies: daisyui@5
target: graph
tags: [daisyui, ui, components]
---
```

| Field | Purpose |
|-------|---------|
| `version` | Semantic version — bump when template content changes |
| `applies` | Condition for when template applies to a project |
| `target` | Deployment target: `rules` or `graph` |
| `priority` | Optional. `high` = load/process first. Omit for normal priority |
| `tags` | Searchable keywords for the template |

## Applies Conditions

Check both `dependencies` and `devDependencies` in `package.json`. Strip version prefixes (`^`, `~`, `>=`, `=`) before comparing.

| Pattern | Matches when... |
|---------|-----------------|
| `Always` | Always applies |
| `react` | `react` in dependencies or devDependencies |
| `react-i18next` | `react-i18next` in dependencies or devDependencies |
| `daisyui@5` | `daisyui` installed, version starts with `5.` |
| `react-router@7.9.0+` | `react-router` installed, version >= 7.9.0 (numeric semver comparison, same major only) |
| `playwright \| "@playwright/test"` | Either package in dependencies or devDependencies (OR) |
| `react-router \| next \| remix` | Any of these packages in dependencies or devDependencies (OR) |
| `remix-i18next & react-router@7` | Both conditions must match (AND) |

### Operators

| Operator | Syntax | Meaning |
|----------|--------|---------|
| `\|` (OR) | `a \| b` | At least one condition matches |
| `&` (AND) | `a & b` | All conditions must match |
| `@N` | `pkg@5` | Package version starts with `N.` (major match) |
| `@X.Y.Z+` | `pkg@7.9.0+` | Package version >= X.Y.Z within same major (numeric semver, not string comparison) |

**If version cannot be parsed**, skip the template and warn the user.

### Target deployment rules

| Target | Source | Deploy to | Discovery |
|--------|--------|-----------|-----------|
| `rules` | `core/{subdir}/{name}.md` | `.claude/rules/core/{name}.md` (subdir stripped) | Auto-discovered by Claude Code |
| `graph` | `vendor/{name}.md` | KG entity `Vendor{PascalCaseName}` | `search_nodes` + `open_nodes` |

## Version Comparison Rules

- Parse version from YAML frontmatter (first `---` block)
- If deployed version has no frontmatter -> treat as legacy, always update
- If versions match -> skip unless user forces update
- Always preserve frontmatter when deploying

## When to Bump Template Versions

When editing templates in the boilerplate, bump the version:

| Change type | Version bump | Example |
|-------------|--------------|---------|
| Fix typo, clarify wording | PATCH | 1.0.0 -> 1.0.1 |
| Add new section, expand content | MINOR | 1.0.0 -> 1.1.0 |
| Restructure, breaking changes | MAJOR | 1.0.0 -> 2.0.0 |

**After editing a template:**
1. Update the `version` in frontmatter
2. Test with `/webstack update` on a project
3. Verify the version diff shows correctly

## Version Awareness

For vendor entities, always check the installed version in `package.json`. A `VendorDaisyui5` entity is wrong for a project on DaisyUI 4. When the version doesn't match a template, skip it and tell the user — they may want to create version-specific knowledge manually.
