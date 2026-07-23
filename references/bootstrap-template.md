# CLAUDE.md Bootstrap Template

Deploy this template when creating or updating CLAUDE.md in target projects. Vendor docs auto-load via path-scoped rules in `.claude/rules/vendor/` regardless of CLAUDE.md content. The knowledge model (where pitfalls/decisions live, how to record them) is in `.claude/rules/core/knowledge-base.md` (auto-loaded); MCP tool usage rules are in `.claude/rules/core/mcp-tools.md` (auto-loaded).

## Template

```markdown
# CLAUDE.md

Project-specific configuration. Core conventions are in `.claude/rules/core/` (auto-loaded).
This file contains **project overrides** and **architecture context**.

> **Setup:** Plugins and shared MCP servers require one-time user setup.
> Run `~/.claude/skills/webstack/scripts/setup-user-env.sh` if tools are missing.

## Commands

\`\`\`bash
# Add project-specific commands here
yarn build        # Build the project
yarn check        # Run all checks
\`\`\`

See `.claude/rules/core/tooling.md` for full workflow rules.

## Critical Conventions

These are enforced by auto-loaded rules in `.claude/rules/core/`. Summary for quick reference:

- **CRITICAL:** Look up library docs (package.json version → Context7 + web search) before writing any library code. Every time, no exceptions.
- **CRITICAL:** When you fix a non-trivial bug or make an architectural decision, record it as a path-scoped page with `.claude/scripts/wiki.sh new` — project knowledge auto-loads from `.claude/rules/project/`, so there is nothing to query, but nothing records itself either.
- **IMPORTANT:** Default to plan mode for anything beyond trivial fixes.
- **IMPORTANT:** Research established domain patterns before implementing features — don't reinvent what the industry already solved.

Full rules are in `core/process/engineering-discipline`, `core/process/mcp-tools`, and `core/process/knowledge-base` (auto-loaded).

## Architecture

<!-- User adds project-specific architecture here -->

## Rules

Core conventions are in `.claude/rules/core/` (auto-loaded, managed by the webstack skill — **do not edit**).
Add project-specific knowledge in `.claude/rules/project/` (pitfalls, decisions, conventions, domain maps)
and heavy reference in `.claude/docs/`. Both are yours and survive `/webstack update`.

Run `/webstack update` regularly to pull the latest rule and vendor doc improvements. The skill tracks versions — only changed templates are updated.

## Vendor Knowledge

Vendor docs are deployed as path-scoped rules in `.claude/rules/vendor/` and auto-load when you read files in their scope — no manual loading required. There is no Knowledge Graph.

<!-- GENERATED: the skill fills this table from which vendor rules were deployed. -->
| Task domain | Vendor rules (auto-load on) |
|-------------|-----------------------------|
<!-- Add rows here for each deployed domain. Example:
| Routing | route files (**/routes/**) |
| Styling | *.tsx / *.css |
-->

### Knowledge accumulation

Project knowledge lives in `.claude/rules/project/` as path-scoped Markdown — see `core/process/knowledge-base` (auto-loaded). Record findings with `.claude/scripts/wiki.sh new <type> <slug>`:
- **pitfall** — a bug's Symptom / Root cause / Fix, scoped to the code it concerns
- **decision** — Decision / Why / Rejected alternatives
- **convention** — a pattern others must follow

One fact per page. Scope each to the narrowest `paths:` glob that fires. Run `.claude/scripts/wiki.sh sync` after adding pages.

Session progress → Claude Code auto memory (`MEMORY.md`), separate from the project wiki.
```

## Init: Create CLAUDE.md

On `/webstack init`, if no CLAUDE.md exists:
1. Create CLAUDE.md with the bootstrap template above (includes Vendor Knowledge)
2. Tell the user to fill in the Architecture and Project-Specific sections

If CLAUDE.md exists but is missing required sections:
1. Check for `## Vendor Knowledge` heading — if missing, append the Vendor Knowledge section
2. Show the user what was added
