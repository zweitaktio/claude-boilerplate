# CLAUDE.md Drift Checks

On `/webstack update`, step 1 runs drift detection against the bootstrap template invariants.

## Section Classification

| Section | Classification | What we check |
|---------|---------------|---------------|
| `# CLAUDE.md` + intro | Managed | Heading exists; intro references `.claude/rules/core/` |
| `## Commands` | Project-specific | Heading exists (content is user-owned) |
| `## Architecture` | Project-specific | Heading exists (content is user-owned) |
| `## Rules` | Mixed | Heading exists; intro references `.claude/rules/core/` |
| `## Vendor Knowledge` | Managed | Heading exists; contains a domain table |
| `### Knowledge accumulation` | Managed | Heading exists; references the project wiki (`wiki.sh` / `.claude/rules/project` / `pitfall`) |

## Vendor Knowledge Heading Aliases

Accept as equivalent to `## Vendor Knowledge`:
- `## Knowledge Graph`
- `## KG Entities`
- `## Vendor Docs`

If an alias is found, treat S1 as PASS and note the non-standard name as INFO.

## Drift Checks

| ID | Check | Severity | How |
|----|-------|----------|-----|
| S0 | CLAUDE.md exists at project root | FAIL | If absent, everything below is moot — suggest `/webstack init` and skip S1–C5 |
| S1 | Required headings exist | MISSING | Check for: `## Commands`, `## Architecture`, `## Rules`, `## Vendor Knowledge` (or alias), `### Knowledge accumulation` |
| S2 | Legacy section names | WARN | Flag: `## Vendor Memory Loading`, `## MCP Tools:` |
| C1 | Rules intro references core rules | WARN | Text between `## Rules` and next `##` heading contains `.claude/rules/core/` |
| C2 | Vendor Knowledge has domain table | WARN | Section contains a markdown table row (`\| … \|`) |
| C4 | Knowledge accumulation references the wiki | WARN | Section contains `wiki.sh`, `rules/project`, or `pitfall` |
| C5 | No inlined MCP tool instructions | INFO | No `## MCP Tools` section with tool names (belongs in `.claude/rules/core/mcp-tools.md`) |

**C3 is retired.** It checked that each vendor entry matched a Knowledge Graph entity; the KG → wiki
migration removed the entities, so the check had nothing to compare. The ID is not reused — see
`KNOWN-ISSUES.md` § 1.

**Not checked (intentionally):** exact wording of managed sections, empty project-specific sections, section ordering, HTML comment placeholders.

## Report Format

```
### CLAUDE.md Drift Report

| Check | Status | Finding |
|-------|--------|---------|
| Required headings | MISSING | `### Knowledge accumulation` not found |
| Legacy sections | WARN | `## MCP Tools:` found — remove (now in rules) |
| Vendor table freshness | WARN | Table lists a domain with no deployed vendor rule |
| Rules intro | PASS | — |
```

Show only WARN and MISSING findings. If all checks pass, show: "CLAUDE.md drift check: no issues detected."

**If CLAUDE.md was never bootstrapped** (no `## Vendor Knowledge` and no known alias): skip detailed checks, show:
```
CLAUDE.md exists but has no managed sections. Run `/webstack init` to bootstrap.
```

**The drift report is informational, not blocking** — always continue with template updates regardless of findings. For MISSING sections, offer to append from bootstrap template. For legacy sections, offer to rename/remove.

**Never overwrite** existing project-specific content (Commands, Architecture, Rules).
