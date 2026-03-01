# CLAUDE.md Drift Checks

On `/webstack update`, step 1 runs drift detection against the bootstrap template invariants.

## Section Classification

| Section | Classification | What we check |
|---------|---------------|---------------|
| `# CLAUDE.md` + intro | Managed | Heading exists; intro references `.claude/rules/core/` |
| `## Commands` | Project-specific | Heading exists (content is user-owned) |
| `## Architecture` | Project-specific | Heading exists (content is user-owned) |
| `## Rules` | Mixed | Heading exists; intro references `.claude/rules/core/` |
| `## Vendor Knowledge` | Managed | Heading exists; contains domain table; references `search_nodes` |
| `### Knowledge accumulation` | Managed | Heading exists; contains observation format strings |

## Vendor Knowledge Heading Aliases

Accept as equivalent to `## Vendor Knowledge`:
- `## Knowledge Graph`
- `## KG Entities`
- `## Vendor Docs`

If an alias is found, treat S1 as PASS and note the non-standard name as INFO.

## Drift Checks

| ID | Check | Severity | How |
|----|-------|----------|-----|
| S1 | Required headings exist | MISSING | Check for: `## Commands`, `## Architecture`, `## Rules`, `## Vendor Knowledge` (or alias), `### Knowledge accumulation` |
| S2 | Legacy section names | WARN | Flag: `## Vendor Memory Loading`, `## MCP Tools:` |
| C1 | Rules intro references core rules | WARN | Text between `## Rules` and next `##` heading contains `.claude/rules/core/` |
| C2 | Vendor Knowledge has domain table | WARN | Section contains a markdown table with `search_nodes` |
| C3 | Domain table matches deployed entities | WARN | Entity names in table vs entities actually deployed in this update (run after step 8) |
| C4 | Knowledge accumulation has formats | WARN | Section contains at least one of: `Pitfall:`, `GitHub:`, `Docs:` |
| C5 | No inlined MCP tool instructions | INFO | No `## MCP Tools` section with tool names (belongs in `.claude/rules/core/mcp-tools.md`) |

**Not checked (intentionally):** exact wording of managed sections, empty project-specific sections, section ordering, HTML comment placeholders.

## Report Format

```
### CLAUDE.md Drift Report

| Check | Status | Finding |
|-------|--------|---------|
| Required headings | MISSING | `### Knowledge accumulation` not found |
| Legacy sections | WARN | `## MCP Tools:` found — remove (now in rules) |
| Vendor table freshness | WARN | Table lists VendorReactHookFormZod (deleted) |
| Rules intro | PASS | — |
```

Show only WARN and MISSING findings. If all checks pass, show: "CLAUDE.md drift check: no issues detected."

**If CLAUDE.md was never bootstrapped** (no `## Vendor Knowledge` and no known alias): skip detailed checks, show:
```
CLAUDE.md exists but has no managed sections. Run `/webstack init` to bootstrap.
```

**The drift report is informational, not blocking** — always continue with template updates regardless of findings. For MISSING sections, offer to append from bootstrap template. For legacy sections, offer to rename/remove.

**Never overwrite** existing project-specific content (Commands, Architecture, Rules).
