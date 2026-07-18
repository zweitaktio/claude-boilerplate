---
version: 1.0.0
applies: Always
target: rules
priority: high
tags: [curl, context-mode, fetching, web-content]
---

Use `curl` only to download a file to disk. Fetch web content — docs, API references, changelogs, HTML pages, JSON you intend to read — with context-mode `fetch_and_index`, then `search`.

`curl` dumps the whole response into context. `fetch_and_index` keeps it in the sandbox and returns a preview, so the bytes you never read cost you nothing.

```bash
# Good — curl writes to disk, nothing enters context
curl -o vendor/schema.json https://example.com/schema.json

# Bad — the entire page lands in context, unindexed and unsearchable
curl https://raw.githubusercontent.com/org/repo/main/SKILL.md
```

```
# Good — indexed in the sandbox, retrievable on demand
ctx_fetch_and_index(url: "https://raw.githubusercontent.com/org/repo/main/SKILL.md", source: "org skill")
ctx_search(queries: ["frontmatter schema"])
```
