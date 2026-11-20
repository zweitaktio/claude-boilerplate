# Update flow — `/webstack update`

Read this file when `$ARGUMENTS` is `update`. `SKILL.md` § Invocation Instructions sends you here.
Every script path below is absolute. It assumes the default install at `~/.claude/skills/webstack/`.

### On an existing project (`/webstack update`)

**CRITICAL: Use scripts for all file operations.** Never manually copy, write, or edit files in `.claude/rules/core/`, `.claude/hooks/`, or `.claude/settings.json`. The scripts handle version comparison, stack detection, and settings merging deterministically. Manual operations cause version drift, duplicate hooks, and settings corruption.

0. **Run preflight check** — see `SKILL.md` § Requirements. Stop if any dependency is missing.

1. **Run CLAUDE.md drift check:**
   ```bash
   ~/.claude/skills/webstack/scripts/drift-check.sh /path/to/project
   ```
   Show results to user. If S0 FAIL (missing), suggest `/webstack init`. If S1 MISSING, fix with `bootstrap-claude-md.sh`. Continue — informational, not blocking.

1a. **Check MCP wiring:**
   ```bash
   ~/.claude/skills/webstack/scripts/check-mcp-wiring.sh /path/to/project
   ```
   Deploying `.claude/playwright-mcp.config.json` does **not** make it take effect — nothing reads it
   unless `.mcp.json` passes `--config`, and a relative `outputDir`/`--output-dir` resolves against the
   MCP server's cwd rather than the project, so artifacts land wherever Claude Code was launched from.
   The skill does not manage `.mcp.json`, so this must be verified rather than assumed. Report any
   `ERROR` findings and offer the exact `.mcp.json` fix; they are one-line edits.

2. **Run deployment comparison:**
   ```bash
   ~/.claude/skills/webstack/scripts/sync.sh compare /path/to/project
   ```
   Outputs JSON action table. Present it to the user as a formatted table.

3. **The project wiki is preserved automatically.** Everything under `.claude/rules/project/` and
   `.claude/docs/` is project-owned files that `sync.sh apply` never prunes. There is nothing to
   detect or migrate.

4. **Lint the project wiki** (knowledge health):
   ```bash
   /path/to/project/.claude/scripts/wiki.sh lint --root /path/to/project
   ```
   Report schema errors, pages missing `paths:`, glob collisions, staleness, and unreachable docs.
   Present unified findings from steps 1 and 4.

5. **Wait for user approval**

6. **Deploy file-based updates:**
   ```bash
   ~/.claude/skills/webstack/scripts/sync.sh apply /path/to/project
   ```
   This single command deploys all rules, hooks, configs, merges settings, prunes stale files, and records `.claude/webstack.sha`. Do NOT manually write any files that this command handles. Report any `PRUNE` actions to the user — these are files removed because they no longer exist in the skill.

   **Safe directories:** `.claude/rules/project/` is never touched — pruning is scoped to `core/` and `vendor/` only. Project-specific rules are always preserved.

7. **Regenerate the wiki index:**
   ```bash
   /path/to/project/.claude/scripts/wiki.sh sync --root /path/to/project
   ```
   Refreshes `WIKI.md` and backlinks from the project pages' frontmatter.

8. **Cleanup legacy artifacts:** rules and hooks are pruned automatically by `sync.sh apply` (action
   `PRUNE`). `.claude/rules/project/` and `.claude/docs/` are never pruned. No manual KG cleanup exists.

9. **Scan for backport candidates** — knowledge worth contributing back to the skill. `core/process/backporting`
    tells the working agent to flag generalizable findings with `backport: true` frontmatter. Find them:
    ```bash
    # Candidates are pages flagged for backport that have NOT already been carried upstream.
    # `backported:` records the skill sha a page landed in — without excluding it, every past
    # backport re-proposes forever and the scan stops being a work list.
    grep -rl "backport: true" /path/to/project/.claude/rules/project \
      | xargs grep -L "^backported:"
    ```
    For each, and for any project pitfall whose root cause is in a library (not project business logic),
    present a candidate:
    ```
    ### Backport Candidates
    | Page | Type | Content | Action |
    |------|------|---------|--------|
    | pitfalls/clientloader-ssr.md | pitfall | clientLoader SSR behavior | Add to vendor/react-router-8/routing.md |
    | pitfalls/date-hydration.md | pitfall | Date.now() server/client divergence | Add to vendor/react-router-8/routing.md Known Issues |
    ```
    Also check `.claude/rules/` for project rule files outside `core/`/`vendor/`/`project/` that encode
    generalizable patterns — candidates for new core templates.

    **After a candidate lands upstream, stamp its page** with the skill commit that carried it —
    `backported: <sha>` in the page's frontmatter, alongside the existing `backport: true`. Do this in
    the same pass that lands it; a page stamped without the content upstream is worse than an unstamped
    one, because the next scan skips it silently.

    If the user approves:
    1. Read the skill source: `~/.claude/skills/webstack/vendor/{file}.md` or `core/{subdir}/{file}.md`
    2. Add the pitfall/content to the appropriate section
    3. Bump the template's version (patch for pitfall additions)
    4. Note that subsequent `/webstack update` on other projects picks up the change

    This step is informational — skip silently if no candidates are found.

