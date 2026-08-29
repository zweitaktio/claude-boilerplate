# CLAUDE.md Drift Checks

On `/webstack update`, step 1 runs drift detection against the bootstrap template invariants.

## Section Classification

| Section | Classification | What we check |
|---------|---------------|---------------|
| `# CLAUDE.md` + intro | Managed | Heading exists; intro references `.claude/rules/core/` |
| `## How you answer` | Managed | Heading exists; names Simplified Technical English / ASD-STE100 |
| `## Working with other sessions` | Managed | Heading exists; the message format requires complete STE sentences |
| `## Commands` | Project-specific | Heading exists (content is user-owned) |
| `## Architecture` | Project-specific | Heading exists (content is user-owned) |
| `## Rules` | Mixed | Heading exists; intro references `.claude/rules/core/` |
| `## Vendor Knowledge` | Managed | Heading exists; contains a domain table |
| `### Knowledge accumulation` | Managed | Heading exists; references the project wiki (`wiki.sh` / `.claude/rules/project` / `pitfall`) |

## Vendor Knowledge Heading Aliases

Accept as equivalent to `## Vendor Knowledge`:
- `## Vendor Docs`

If an alias is found, treat S1 as PASS and note the non-standard name as INFO.

## Drift Checks

| ID | Check | Severity | How |
|----|-------|----------|-----|
| S0 | CLAUDE.md exists at project root | FAIL | If absent, everything below is moot — suggest `/webstack init` and skip S1–C7 |
| S1 | Required headings exist | MISSING | Check for: `## How you answer`, `## Working with other sessions`, `## Commands`, `## Architecture`, `## Rules`, `## Vendor Knowledge` (or alias), `### Knowledge accumulation` |
| S2 | Legacy section names | WARN | Flag: `## Vendor Memory Loading`, `## MCP Tools:` |
| C1 | Rules intro references core rules | WARN | Text between `## Rules` and next `##` heading contains `.claude/rules/core/` |
| C2 | Vendor Knowledge has domain table | WARN | Section contains a markdown table row (`\| … \|`) |
| C4 | Knowledge accumulation references the wiki | WARN | Section contains `wiki.sh`, `rules/project`, or `pitfall` |
| C5 | No inlined MCP tool instructions | INFO | No `## MCP Tools` section with tool names (belongs in `.claude/rules/core/mcp-tools.md`) |
| C6 | Answer-language rule present | WARN | `## How you answer` section contains `Simplified Technical English` or `ASD-STE100`. On MISSING/WARN, append the section from the bootstrap template |
| C7 | Peer-message format requires STE | WARN | `## Working with other sessions` section contains `complete Simplified Technical English sentence` or `complete sentence`. A section that grants peer messages an exemption is stale — replace it |

**C6 fires on every project bootstrapped before the STE rule landed.** That is the intent: S1 + C6
together are how the rule reaches projects whose CLAUDE.md predates it. Appending the section is safe —
it is a managed section, so it never overwrites project-owned content.

**C7 catches stale content, not a missing heading.** `bootstrap-claude-md.sh` appends a section only
when the heading is absent, so a project that already carries an older `## Working with other sessions`
keeps it forever. On a C7 WARN, replace that managed section's body with the bootstrap template's copy.
Never edit the surrounding project-owned sections.

**C3 is retired.** It checked a vendor entry against a graph entity. The graph is gone, so the check
had nothing to compare. The ID is not reused. See `KNOWN-ISSUES.md` § 1.

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
