# `/webstack maintenance` — Periodic Health Check

Audits deployed rules, the project wiki, settings and project hygiene **without deploying templates**.
Run every few weeks, or when the rule set starts feeling stale or contradictory.

Nothing here writes without asking. Steps 1–10 gather; step 11 proposes; step 12 executes only what the
user approved.

0. **Run preflight check** — see SKILL.md § Requirements. If `.claude/webstack.sha` doesn't exist, warn that `/webstack init` may not have run yet — continue anyway (some checks still work).

1. **Snapshot project state** — gather all data needed by subsequent steps in one pass. Run these in parallel:

   **a)** Run `scripts/sync.sh compare /path/to/project` → full deployment diff (rules, hooks, configs, vendor)

   **b)** Read `package.json` (root + 1 level deep for monorepos) → installed versions

   **c)** List `.claude/rules/` recursively → deployed rule inventory

   **d)** `.claude/scripts/wiki.sh lint --root /path/to/project` → project wiki health (schema, `paths:`, collisions, staleness, unreachable docs)

   **e)** List `.claude/rules/project/` and `.claude/docs/` → project wiki inventory (pitfalls, decisions, conventions, domain maps, system docs)

   **f)** Read `.claude/settings.json` and `.claude/settings.local.json` (if exists) → permissions, MCP tool patterns

   No user-visible output yet — this feeds steps 2–11.

2. **Vendor rule audit** — for each deployed vendor rule file, run three checks:

   **a) Rule file drift:**
   Compare deployed `.claude/rules/vendor/*.md` against skill source `vendor/*.md` using `sync.sh compare --group vendor`. Flag files where the deployed version is older than the template.

   **b) Installed version match:**
   ```
   Rule file applies: daisyui@5
   package.json: daisyui@5.8.0 → PASS (major matches)

   Rule file applies: daisyui@5
   package.json: daisyui@6.1.0 → MISMATCH — rule is for v5, project has v6
   ```
   Flag if the project upgraded past the rule's major version.

   **c) Orphaned files:** vendor rule files in `.claude/rules/vendor/` with no matching source template in the boilerplate (candidates for removal in step 12).

   Output table:
   ```
   | Rule File | Template Ver | Deployed Ver | Installed | Status |
   |-----------|-------------|-------------|-----------|--------|
   | daisyui-5.md | 1.3.0 | 1.3.0 | 5.8.0 | PASS |
   | react-router-8/routing.md | 2.0.0 | 1.5.0 | 7.11.0 | DRIFT |
   | payload/cms-3.md | 1.2.0 | 1.2.0 | 4.1.0 | MISMATCH (rule v3, installed v4) |
   | old-library.md | — | 1.0.0 | (removed) | ORPHAN |
   ```
   Report-only. DRIFT → suggest running `/webstack update`. MISMATCH → warn that the rule may describe patterns that no longer apply. ORPHAN → propose removal in step 12.

3. **Core rules file audit** — compare `.claude/rules/core/*.md` against boilerplate templates:

   - **Orphaned rules** — files in `core/` with no matching template (template removed or renamed)
   - **Missing rules** — templates where `applies` matches the stack but no file is deployed
   - **Version drift** — deployed version vs template version (same extraction as update step 2)
   - **Content tampering** — if versions match, diff content bodies to detect local edits that the next `/webstack update` will silently overwrite

   Output table:
   ```
   | Rule File | Template | Deployed Ver | Template Ver | Status |
   |-----------|----------|-------------|-------------|--------|
   | tooling.md | core/process/tooling | 2.2.0 | 2.2.0 | PASS |
   | react-components.md | core/frontend/... | 1.5.0 | 1.6.0 | DRIFT |
   | old-rule.md | (none) | 1.0.0 | — | ORPHAN |
   | — | core/testing/e2e | — | 1.1.0 | MISSING |
   | tooling.md | core/process/tooling | 2.2.0 | 2.2.0 | MODIFIED (local edits) |
   ```
   Report-only. ORPHAN files are proposed for removal in step 11.

4. **Project wiki audit** — from the `wiki.sh lint` snapshot (step 1d), report:

   - **Schema errors** — pages with missing/invalid frontmatter, `type:`/`status:` out of enum
   - **Missing/unbounded `paths:`** — a page with no `paths:` always-loads; a `**` glob floods context
   - **Glob collisions** — >~8 pages sharing one glob (reading one file injects them all)
   - **Staleness** — pages whose `verified-against:` names a version no longer installed (check `package.json`)
   - **Unreachable docs** — `.claude/docs/` system docs that no domain map or page links to
   - **Bloat** — atoms over the line budget (candidates to split, or move detail to a `.claude/docs/` doc)

   Report-only. `wiki.sh lint` produces most of this; add the staleness cross-check against installed versions.

   **Then run the distillation pass:**

   ```bash
   node .claude/scripts/wiki-review.ts      # verdicts: RETIRE? / FIX / MERGE / REVIEW
   node .claude/scripts/ste-check.ts        # language violations in project pages
   node .claude/scripts/dupe-check.ts       # two pages that say the same thing
   ```

   `wiki-review.ts` is the tool that keeps the wiki from growing without limit. It flags a page whose
   `paths:` match no file, a page behind its `verified-against:` major, a page nobody has reviewed in
   180 days, an oversized page, a `superseded` page with no successor, a pitfall with no
   trip-task, and a pitfall whose `proof:` shows it changes nothing.

   **Propose one action per verdict. Never act without the user's approval.**

   | Verdict | Proposal |
   |---------|----------|
   | `PROVE` | Run `node .claude/scripts/pitfall-eval.ts --case <slug> --n 8`, then write the `proof:` line |
   | `RETIRE?` | Confirm the cause, then set `status: archived` with `archived-reason`, and move the file to `.claude/rules/project/archive/` |
   | `FIX` | Repair the frontmatter |
   | `MERGE` | One page owns the fact. Archive the other with `superseded-by:` |
   | `REVIEW` | Re-verify the fact against the official source, then set `last-reviewed:` |

   `core/knowledge-base` § Review and retire holds the retirement test. **Never retire on age alone.**

5. **Rule contradiction detection** — analyze all rule files in `.claude/rules/` plus `CLAUDE.md` for conflicting instructions:

   **a) Opposing directives** — scan for instruction pairs that commonly conflict:
   - Component exports: `export default` vs `export const` (named)
   - Component typing: `React.FC` vs bare arrow functions
   - Error handling: `try/catch` in loaders vs ErrorBoundary-only
   - Dev workflow: "never run dev server" vs "run yarn dev"
   - Import style: barrel imports vs direct imports

   Read each rule file, collect directive statements, flag contradicting pairs across files.

   **b) Scope overlap** — check for rules with overlapping `paths:` frontmatter that cover the same topic with different guidance. Extract `paths:` from each rule file's frontmatter and find intersections.

   **c) CLAUDE.md vs rules** — instructions in CLAUDE.md that contradict a deployed rule. Since CLAUDE.md takes precedence, flag these so the user can decide whether to update the rule or the CLAUDE.md.

   **d) Stale references** — rules referencing commands (`yarn xyz`), file paths (`app/features/...`), or tool names that no longer exist in the project. Check against `package.json` scripts, file system, and available MCP tools.

   **e) Prompt patterns for older models** — ask the user to run `/doctor prompt-audit` in the target
   project. It needs Claude Code 2.1.283 or later. It audits the CLAUDE.md files, skills, agents and
   commands. Claude cannot start a built-in slash command, so the user runs it and pastes the result.
   List each finding in a separate table with the columns `File | Pattern | Fix`. A finding in a
   deployed template is a fix for this repository, not for the target.

   Output:
   ```
   | File A | File B | Topic | Conflict |
   |--------|--------|-------|----------|
   | core/react-components.md | CLAUDE.md | Exports | "named exports only" vs "export default for pages" |
   | core/tooling.md | .claude/rules/dev.md | Dev server | "never start" vs "yarn dev" |
   | core/tooling.md | — | Command | References `yarn typecheck` (not in package.json scripts) |
   ```
   Report-only — user decides precedence.

6. **Stray file detection:**
   ```bash
   ~/.claude/skills/webstack/scripts/find-strays.sh /path/to/project
   ```
   Outputs JSON array of stray `.md` files with path, size, git status, and frontmatter detection.

   The project wiki (`.claude/rules/project/`) and the upstream trees (`core/`, `vendor/`) are excluded by
   the script — anything it reports is genuinely outside a managed structure. Report-only; the user decides
   whether to keep it, convert it into a wiki page (`wiki.sh new`), or delete it.

7. **Settings & MCP audit:**
   ```bash
   ~/.claude/skills/webstack/scripts/audit-settings.sh /path/to/project
   ```
   Outputs JSON with `permission_wildcards` (non-wildcarded MCP entries), `stale_hooks` (missing hook files), and `deny_entries` (informational).

   Auto-fixable: rewrite non-wildcarded entries as server-prefix wildcards. Stale hooks resolved by `sync.sh apply --group hooks,hook-infra,settings`.

   Watch for pinned tool names. A wildcard (`mcp__server__*`) survives an upstream tool rename; an entry
   naming one tool silently stops matching when that tool is renamed.

   Then verify the Playwright MCP wiring in `.mcp.json`:
   ```bash
   ~/.claude/skills/webstack/scripts/check-mcp-wiring.sh /path/to/project
   ```
   `.mcp.json` is **not** skill-managed, so deploying `.claude/playwright-mcp.config.json` proves
   nothing about whether it is used. Findings worth acting on:
   - `PW3`/`PW4` ERROR — `--config` or `--output-dir` missing. The deployed config is inert, or
     artifacts are written relative to the MCP server's cwd and follow wherever Claude Code was
     launched from. Both are one-line `.mcp.json` edits.
   - `PW6` ERROR — a relative `outputDir` in the config file. `path.resolve()` anchors it to the
     server's cwd, not the config file's directory. Remove it; the CLI flag is the only reliable place.
   - `PW7` WARN — `@latest` lets output-path behaviour change between sessions. Pin the version.
   - `PW9` INFO — `.playwright-mcp/` residue predating the fix. Check the file dates before deleting;
     it is also the tell that the wiring was broken at some point.

8. **Context budget analysis:**
   ```bash
   ~/.claude/skills/webstack/scripts/context-budget.sh /path/to/project
   ```
   Outputs JSON with `always_loaded` rules, `path_scoped` rules (flagging broad patterns), `claude_md` size, and `totals` (vs 850-line / 20KB budget).
   Informational only.

9. **Cross-page contradiction detection** — find conflicting guidance across wiki pages and vendor rules:

   **a) Cross-page contradictions:** For pages in the same domain (shared `tags:`/`paths:`), compare guidance.
   Look for contradicting version requirements, conflicting patterns without a "when to use which," and a
   pitfall page that contradicts a convention page or a vendor rule.

   **b) Pitfall staleness verification** (optional, user-gated): for a pitfall page that carries
   `verified-against:`, check the fact against the official source at the installed version. Ask first:
   "Found N verifiable pitfalls. Verify against the official docs? (y/n)"
   ```
   For each pitfall page:
     Read the installed version of the package named in verified-against.
     Fetch that library's docs or release notes at that version tag (core/mcp-tools step 3).
     Compare: is the fact still true? If the upstream fixed it, propose status: archived.
   ```

   Output:
   ```
   ### Cross-Page Contradictions
   | Page A | Page B | Topic | Conflict |
   |--------|--------|-------|----------|
   | pitfalls/clientloader-ssr.md | conventions/data-loading.md | clientLoader | contradicting SSR behavior |

   ### Stale Pitfalls (verified against the official source)
   | Page | Pitfall | Current Status |
   |------|---------|---------------|
   | pitfalls/btn-ghost-color.md | "btn-ghost needs explicit color in v5" | FIXED in 5.7.0 → supersede |
   ```
   Report-only. A stale pitfall is proposed for `status: archived` in step 11.

10. **CLAUDE.md drift check:**
    ```bash
    ~/.claude/skills/webstack/scripts/drift-check.sh /path/to/project
    ```
    Same checks as update step 1 but standalone. Offer to auto-fix MISSING sections with `bootstrap-claude-md.sh`.

11. **Remediation proposals** — aggregate all findings into a unified health report:

    **Auto-fixable** (after blanket user approval):
    - Regenerate `WIKI.md` + backlinks (`wiki.sh sync`) if stale (step 1d/4)
    - Non-wildcarded MCP permissions → rewrite as server-prefix wildcards (step 8a)
    - Stale hook entries → remove from settings (step 8c)
    - Missing CLAUDE.md sections from bootstrap template (step 11, MISSING items)

    **User-decision required:**
    - Remove orphaned rule files from `.claude/rules/core/`,`vendor/` (steps 2c, 3)
    - Fix wiki schema errors / add missing `paths:` / split colliding or bloated pages (step 4)
    - Resolve rule/page contradictions — decide which takes precedence (steps 5, 9)
    - Handle stray files — convert to a wiki page (`wiki.sh new`) or delete (step 6)
    - Stale MCP server references are proposed for removal (step 7b)
    - `status: archived` for a pitfall the upstream fixed (step 9b), with `archived-reason`

    **Informational** (no action, awareness only):
    - Version drift between templates and deployed rules → recommend `/webstack update` (step 2a)
    - Installed version mismatches (step 2b)
    - Context budget breakdown (step 9)
    - Content tampering in rules (step 3)
    - Stale deny entries (step 8d)

    Ask: "Apply auto-fixes? (WIKI.md regen, CLAUDE.md sections, MCP wildcards, stale hooks)"

12. **Execute fixes and final report:**

    Execute approved auto-fixes:
    - `wiki.sh sync` to regenerate `WIKI.md` + backlinks
    - Rewrite `permissions.allow` entries to use server-prefix wildcards, remove redundant individual entries
    - Remove stale hook entries from `.claude/settings.json`
    - Append missing sections to CLAUDE.md from bootstrap template

    Execute user-approved individual fixes:
    - Edit wiki pages to fix schema / add `paths:` / set `status: superseded` on stale pitfalls
    - Remove stale MCP permission entries
    - Add missing hook entries to `.claude/settings.json`
    - Delete approved stray files

    Log each action taken.

    **Final report:**
    ```
    ### Health Report Summary

    | Category | Issues Found | Fixed | Needs User Action | Info Only |
    |----------|-------------|-------|--------------------|-----------|
    | Vendor versions | 3 | 0 | 0 | 3 (run /webstack update) |
    | Core rules | 2 | 0 | 1 orphan | 1 drift |
    | Project wiki (lint) | 8 | 1 (sync) | 5 (paths/split) | 2 |
    | Legacy graph | 1 | 0 | 1 (migrate) | 0 |
    | Rule/page contradictions | 2 | 0 | 2 | 0 |
    | Stray files | 1 | 0 | 1 | 0 |
    | Settings & MCP | 4 | 2 wildcarded | 1 stale server | 1 deny entry |
    | Context budget | 0 | 0 | 0 | budget OK |
    | CLAUDE.md drift | 1 | 1 | 0 | 0 |
    ```

    **No SHA update** — maintenance does not deploy templates, so the SHA stays unchanged. The SHA only updates on `/webstack init` and `/webstack update`.

## Claude Code baseline

The templates in this repository match Claude Code 2.1.329. The last check ran on 2026-11-20.

A Claude Code release can change how rules, hooks, skills and settings behave. Read the changelog
entries after this version before the next template review. Then update the version and the date here.

Changelog: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
