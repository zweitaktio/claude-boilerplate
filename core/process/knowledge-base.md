---
version: 2.0.0
applies: Always
target: rules
priority: high
tags: [knowledge, wiki, memory, rules, atomicity, pitfalls, decisions]
---

# Project Knowledge Base

Project knowledge is path-scoped Markdown. A page under `.claude/rules/project/` auto-loads in full the
moment you read a file matching its `paths:` glob, so a pitfall reaches you exactly when you open the
code it concerns. **You never query for it.** Reading is automatic. Your job is to **write** what you
learn.

## Record what you learn — this is the rule that matters

The one failure mode: fixing a bug or making a decision and moving on without recording it. Don't.
**Within ~2 tool calls of the discovery, create a page** with the scaffold:

```bash
.claude/scripts/wiki.sh new <pitfall|decision|convention|system> <slug>
```

| You just… | Create a |
|-----------|----------|
| fixed a bug that misled you or spanned >3 files | `pitfall` — Symptom, Root cause, Fix |
| chose approach X over Y for a reason | `decision` — Decision, Why, Rejected |
| established a pattern others must follow | `convention` — the rule + where it applies |
| built a non-obvious custom subsystem | `system` doc in `.claude/docs/`, linked from a domain map |

Run `.claude/scripts/wiki.sh find "<topic>"` first — if a near-match exists, extend that page instead
of creating a duplicate. Never hand-author frontmatter; the scaffold writes valid frontmatter and the
`rules-guard` hook will block a page that lacks it.


The frontmatter schema, the proving procedure, the review cycle and the backporting rules are in
`core/knowledge-base-authoring`. That file loads when you open a page under `.claude/rules/project/`.
The `rules-guard` hook gates the write itself, because a write triggers no path-scoped rule.
