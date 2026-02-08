---
version: 1.1.0
applies: remark-lint-frontmatter-schema
target: graph
tags: [markdown, frontmatter, schema, validation, remark]
---

# Remark Frontmatter Schema

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| npm | https://www.npmjs.com/package/remark-lint-frontmatter-schema | Package info |
| GitHub | https://github.com/JulianCataldo/remark-lint-frontmatter-schema | Source, README, examples |
| remark | https://github.com/remarkjs/remark | Parent ecosystem |
| unified | https://unifiedjs.com | Unified.js ecosystem docs |

## Setup

- **Config**: `.remarkrc.mjs`
- **Schemas**: `content/*.schema.yaml`
- **CLI**: `remark content --quiet` (runs as part of `yarn check`)

## Schema Mapping

Map glob patterns to YAML schemas in `.remarkrc.mjs`:

```javascript
import remarkFrontmatterSchema from 'remark-lint-frontmatter-schema'

export default {
  plugins: [
    [remarkFrontmatterSchema, {
      schemas: {
        'content/post.schema.yaml': 'content/**/posts/**/*.mdx',
        'content/page.schema.yaml': 'content/**/home.mdx',
      }
    }]
  ]
}
```

## Common Frontmatter Fields

| Field | Type | Notes |
|-------|------|-------|
| title | string | Required for posts/pages |
| description | string | Optional |
| published | string (date) | Required for posts/timeline |
| tags | array of strings | Optional |
| image | string | Optional, relative path |
| imageAttribution | object | Optional, `{ name, link }` |

## Adding New Content Types

1. Create schema in `content/{type}.schema.yaml`
2. Add glob mapping in `.remarkrc.mjs` under `schemas`
3. Run `yarn check` to validate

## Known Issues

- **Arrays must use proper YAML syntax** `['item']`, not escaped `\['item']`
- **"no issues found" on malformed files**: Check frontmatter uses `---` delimiters (not `***`)
- **Schema not applied**: Verify glob pattern matches file path in `.remarkrc.mjs`
