# CLAUDE.md Bootstrap Template

Deploy this template when creating or updating CLAUDE.md in target projects. The skill MUST ensure CLAUDE.md contains the vendor knowledge section, otherwise vendor docs in the Knowledge Graph won't be loaded correctly. MCP tool usage rules are in `.claude/rules/core/mcp-tools.md` (auto-loaded).

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

## Architecture

<!-- User adds project-specific architecture here -->

## Rules

Core conventions are in `.claude/rules/core/` (auto-loaded, managed by the webstack skill — **do not edit**).
Add project-specific rules in `.claude/rules/project/` to keep them separate from skill-managed rules.

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
