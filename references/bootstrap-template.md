# CLAUDE.md Bootstrap Template

Deploy this template when creating or updating CLAUDE.md in target projects. The vendor knowledge section in CLAUDE.md provides a domain-to-KG-entity mapping for discoverability via `search_nodes`. Vendor docs themselves auto-load via path-scoped rules in `.claude/rules/vendor/` regardless of CLAUDE.md content. MCP tool usage rules are in `.claude/rules/core/mcp-tools.md` (auto-loaded).

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

- **CRITICAL:** Look up library docs (package.json → KG pitfalls → Context7) before writing any library code. Every time, no exceptions.
- **CRITICAL:** Query the Knowledge Graph for pitfalls and architecture decisions before finalizing any plan.
- **IMPORTANT:** Default to plan mode for anything beyond trivial fixes.
- **IMPORTANT:** Research established domain patterns before implementing features — don't reinvent what the industry already solved.

Full rules are in `core/process/engineering-discipline` and `core/process/mcp-tools` (auto-loaded).

## Architecture

<!-- User adds project-specific architecture here -->

## Rules

Core conventions are in `.claude/rules/core/` (auto-loaded, managed by the webstack skill — **do not edit**).
Add project-specific rules in `.claude/rules/project/` to keep them separate from skill-managed rules.

Run `/webstack update` regularly to pull the latest rule and vendor doc improvements. The skill tracks versions — only changed templates are updated.

## Vendor Knowledge

Vendor docs are deployed as path-scoped rules in `.claude/rules/vendor/` and auto-load when you edit files in their scope — no manual loading required.

The Knowledge Graph holds lightweight references for discoverability. Use `search_nodes` when looking up bug resolutions or pitfalls, not to load vendor docs.

<!-- GENERATED: The skill populates this table based on which vendor entities were deployed. -->
| Task domain | Vendor rules (auto-loaded) | KG entities |
|-------------|---------------------------|-------------|
<!-- Add rows here for each deployed domain. Example:
| Routing | auto-loads on route files | VendorReactRouter7* |
| Styling | auto-loads on *.tsx / *.css | VendorDaisyui5, VendorTailwind4 |
-->

### Knowledge accumulation

Write triggers are defined in `core/process/mcp-tools` (auto-loaded). Key observation formats:
- Pitfalls: `"Pitfall: {what} — {why}"`
- GitHub issues: `"GitHub: {url} — {summary}"`
- Doc findings: `"Docs: {key finding} (source: {url})"`

Session progress → Claude Code auto memory (`MEMORY.md`).
New project rules → add to CLAUDE.md, not the Knowledge Graph.
```

## Init: Create CLAUDE.md

On `/webstack init`, if no CLAUDE.md exists:
1. Create CLAUDE.md with the bootstrap template above (includes Vendor Knowledge)
2. Tell the user to fill in the Architecture and Project-Specific sections

If CLAUDE.md exists but is missing required sections:
1. Check for `## Vendor Knowledge` heading — if missing, append the Vendor Knowledge section
2. Show the user what was added
